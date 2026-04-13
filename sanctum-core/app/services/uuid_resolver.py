"""Shared UUID prefix resolution service (#1931).

Allows API endpoints to accept either full UUIDs or short hex prefixes (8+
chars) and resolve them to a single entity. If the prefix is ambiguous, a 409
is returned with candidate details.
"""

from uuid import UUID
from typing import Any, List, Optional, Type

from fastapi import HTTPException
from sqlalchemy import cast, func, String
from sqlalchemy.orm import Session

MIN_PREFIX_LENGTH = 8
MAX_CANDIDATES = 10


def _get_label(entity: Any) -> str:
    """Extract a human-readable label from an entity using duck typing."""
    for attr in ("name", "subject", "title", "slug"):
        val = getattr(entity, attr, None)
        if val:
            return str(val)
    return str(entity.id)


def _strip_dashes(s: str) -> str:
    return s.replace("-", "")


def resolve_uuid(
    db: Session,
    model_class: Type,
    id_value: str,
    *,
    column: Any = None,
    deleted_filter: bool = True,
) -> UUID:
    """Resolve a full UUID or short hex prefix to a single entity UUID.

    Returns:
        The resolved UUID.

    Raises:
        HTTPException(404): No match found.
        HTTPException(409): Ambiguous prefix -- multiple matches.
        HTTPException(422): Prefix too short or invalid hex.
    """
    if column is None:
        column = model_class.id

    # --- 1. Try full UUID ---
    try:
        uuid_val = UUID(id_value)
        query = db.query(model_class).filter(column == uuid_val)
        if deleted_filter and hasattr(model_class, "is_deleted"):
            query = query.filter(model_class.is_deleted == False)  # noqa: E712
        entity = query.first()
        if entity is None:
            raise HTTPException(
                status_code=404,
                detail=f"{model_class.__name__} not found",
            )
        return entity.id
    except ValueError:
        pass

    # --- 2. Validate hex prefix ---
    clean = _strip_dashes(id_value)
    if not all(c in "0123456789abcdefABCDEF" for c in clean):
        raise HTTPException(
            status_code=422,
            detail="UUID prefix must contain only hexadecimal characters",
        )
    if len(clean) < MIN_PREFIX_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"UUID prefix must be at least {MIN_PREFIX_LENGTH} hexadecimal characters",
        )

    # --- 3. Prefix query ---
    # Compare dash-stripped prefix against dash-stripped UUID text
    stripped_col = func.replace(cast(column, String), "-", "")
    query = db.query(model_class).filter(stripped_col.like(f"{clean.lower()}%"))
    if deleted_filter and hasattr(model_class, "is_deleted"):
        query = query.filter(model_class.is_deleted == False)  # noqa: E712
    matches = query.limit(MAX_CANDIDATES + 1).all()

    if len(matches) == 0:
        raise HTTPException(
            status_code=404,
            detail=f"{model_class.__name__} not found",
        )

    if len(matches) == 1:
        return matches[0].id

    # --- 4. Ambiguous ---
    candidates = [
        {"id": str(m.id), "label": _get_label(m)}
        for m in matches[:MAX_CANDIDATES]
    ]
    match_count = len(matches) if len(matches) <= MAX_CANDIDATES else f"{MAX_CANDIDATES}+"
    raise HTTPException(
        status_code=409,
        detail={
            "detail": "Ambiguous UUID prefix",
            "prefix": clean,
            "match_count": match_count,
            "candidates": candidates,
            "truncated": len(matches) > MAX_CANDIDATES,
        },
    )


def get_or_404(
    db: Session,
    model_class: Type,
    id_value: str,
    *,
    options: Optional[List] = None,
    deleted_filter: bool = True,
) -> Any:
    """Resolve UUID prefix and fetch the entity, with optional eager loads.

    Returns:
        The ORM entity.

    Raises:
        HTTPException(404): Not found.
        HTTPException(409): Ambiguous prefix.
        HTTPException(422): Invalid prefix.
    """
    resolved_id = resolve_uuid(
        db, model_class, id_value, deleted_filter=deleted_filter
    )
    query = db.query(model_class)
    if options:
        for opt in options:
            query = query.options(opt)
    entity = query.filter(model_class.id == resolved_id).first()
    if entity is None:
        raise HTTPException(
            status_code=404,
            detail=f"{model_class.__name__} not found",
        )
    return entity
