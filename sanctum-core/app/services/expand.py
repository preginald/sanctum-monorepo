"""
API Expand Contract (SYS-032) — response field expansion service.

Controls which nested fields are included in API responses. By default,
service accounts get lean responses (counts only) and human users get
full responses (all nested data). Any consumer can override via ?expand=...
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import json

from fastapi import Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from .. import models


# Expandable fields per entity type (SYS-032 contract)
EXPANDABLE_FIELDS: dict[str, set[str]] = {
    "project": {"milestones", "artefacts"},
    "article": {"history", "related_articles", "artefacts", "content"},
    "artefact": {"content", "description"},
    "milestone": {"ticket_descriptions", "health_check"},
    "ticket": {
        "comments", "articles", "artefacts",
        "time_entries", "materials", "related_tickets",
    },
}


@dataclass
class ExpandConfig:
    """Parsed expand configuration for the current request."""

    fields: set[str] = field(default_factory=set)
    expand_all: bool = False
    consumer_type: str = "human"  # "human", "service"
    raw_param: Optional[str] = None

    def should_expand(self, field_name: str) -> bool:
        """Return True if the given field should be included in the response."""
        if self.expand_all:
            return True
        return field_name in self.fields


def _detect_consumer_type(user: Optional[models.User]) -> str:
    """Determine consumer type from authenticated user."""
    if user is None:
        return "human"
    if user.user_type == "service_account":
        return "service"
    return "human"


def _default_expand_all(consumer_type: str) -> bool:
    """Human users get expand=all by default; service accounts get expand=none."""
    return consumer_type == "human"


def _get_optional_user(
    request: Request,
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    """Soft auth — returns user if a valid token is present, None otherwise."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header[7:]
    if not token:
        return None
    try:
        return get_current_user(token=token, db=db)
    except HTTPException:
        return None


def _parse_expand(expand: Optional[str], consumer_type: str) -> ExpandConfig:
    """Parse the raw expand query parameter into an ExpandConfig."""
    if expand is None:
        return ExpandConfig(
            expand_all=_default_expand_all(consumer_type),
            consumer_type=consumer_type,
            raw_param=None,
        )

    raw = expand.strip().lower()

    if raw == "all":
        return ExpandConfig(
            expand_all=True,
            consumer_type=consumer_type,
            raw_param=expand,
        )

    if raw == "none" or raw == "":
        return ExpandConfig(
            fields=set(),
            expand_all=False,
            consumer_type=consumer_type,
            raw_param=expand,
        )

    fields = {f.strip() for f in raw.split(",") if f.strip()}
    return ExpandConfig(
        fields=fields,
        expand_all=False,
        consumer_type=consumer_type,
        raw_param=expand,
    )


def get_expand_config(
    expand: Optional[str] = Query(
        None,
        description=(
            "Comma-separated fields to expand, 'all' for everything, "
            "'none' for lean response. Omit for consumer-aware default."
        ),
    ),
    current_user: Optional[models.User] = Depends(_get_optional_user),
) -> ExpandConfig:
    """FastAPI dependency that parses ?expand= with optional consumer detection."""
    consumer_type = _detect_consumer_type(current_user)
    return _parse_expand(expand, consumer_type)


def filter_response(
    data: dict,
    expand: ExpandConfig,
    entity_type: str,
) -> dict:
    """Strip unexpanded list fields and replace with counts.

    Operates on a dict (not an ORM object) so it runs after serialisation.
    Unknown expand fields are silently ignored (forward compatibility).
    """
    expandable = EXPANDABLE_FIELDS.get(entity_type, set())

    for field_name in expandable:
        if expand.should_expand(field_name):
            continue

        # Special case: ticket_descriptions strips the description from
        # nested ticket objects rather than removing the tickets list.
        if field_name == "ticket_descriptions":
            tickets = data.get("tickets")
            if isinstance(tickets, list):
                for t in tickets:
                    if isinstance(t, dict):
                        t.pop("description", None)
            continue

        # Special case: health_check is a single object, not a list
        if field_name == "health_check":
            data.pop("health_check", None)
            continue

        # Standard case: remove the list field (count is pre-populated on schema)
        if field_name in data and isinstance(data[field_name], list):
            del data[field_name]
            continue

        # Scalar field removal (e.g. content, description text fields)
        data.pop(field_name, None)

    return data


def _estimate_tokens(data: dict) -> int:
    """Rough token estimate: ~4 chars per token in JSON."""
    return len(json.dumps(data, default=str)) // 4


def expanded_response(
    data: dict,
    expand: ExpandConfig,
    entity_type: str,
) -> JSONResponse:
    """Filter response and return JSONResponse with observability headers."""
    filtered = filter_response(data, expand, entity_type)

    # Build X-Expand-Applied header
    expandable = EXPANDABLE_FIELDS.get(entity_type, set())
    applied = sorted(f for f in expandable if expand.should_expand(f))

    headers = {
        "X-Consumer-Type": expand.consumer_type,
        "X-Expand-Applied": ",".join(applied) if applied else "none",
        "X-Response-Tokens": str(_estimate_tokens(filtered)),
    }

    return JSONResponse(content=filtered, headers=headers)
