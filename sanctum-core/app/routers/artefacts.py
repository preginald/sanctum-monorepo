from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text as sa_text
from typing import List, Optional
import re
from .. import models, schemas, auth
from ..database import get_db
from ..services.expand import ExpandConfig, get_expand_config, expanded_response

router = APIRouter(tags=["Artefacts"])

# Status lifecycle: valid transitions
VALID_TRANSITIONS = {
    'draft': ['review', 'archived'],
    'review': ['approved', 'draft', 'archived'],
    'approved': ['superseded', 'archived'],
    'archived': ['draft'],
    'superseded': [],  # terminal
}


def _get_available_transitions(status: str) -> list:
    return VALID_TRANSITIONS.get(status, [])


def _attach_transitions(artefact):
    """Attach available_transitions to artefact for response serialisation."""
    artefact.available_transitions = _get_available_transitions(artefact.status or 'draft')
    return artefact


def _enrich_links(db: Session, links):
    """Resolve linked_entity_name for each link by joining to the relevant table."""
    if not links:
        return
    # Group link IDs by entity type
    by_type = {}
    for link in links:
        by_type.setdefault(link.linked_entity_type, []).append(link.linked_entity_id)

    # Query name for each entity type in batch
    name_map = {}  # (type, id_str) -> name

    if 'ticket' in by_type:
        ids = [int(i) for i in by_type['ticket']]
        rows = db.execute(sa_text(
            "SELECT id, subject FROM tickets WHERE id = ANY(:ids)"
        ), {"ids": ids}).fetchall()
        for row in rows:
            name_map[('ticket', str(row.id))] = f"#{row.id} {row.subject}"

    if 'project' in by_type:
        rows = db.execute(sa_text(
            "SELECT id::text, name FROM projects WHERE id::text = ANY(:ids)"
        ), {"ids": by_type['project']}).fetchall()
        for row in rows:
            name_map[('project', row.id)] = row.name

    if 'milestone' in by_type:
        rows = db.execute(sa_text(
            "SELECT id::text, name FROM milestones WHERE id::text = ANY(:ids)"
        ), {"ids": by_type['milestone']}).fetchall()
        for row in rows:
            name_map[('milestone', row.id)] = row.name

    if 'account' in by_type:
        rows = db.execute(sa_text(
            "SELECT id::text, name FROM accounts WHERE id::text = ANY(:ids)"
        ), {"ids": by_type['account']}).fetchall()
        for row in rows:
            name_map[('account', row.id)] = row.name

    if 'article' in by_type:
        rows = db.execute(sa_text(
            "SELECT id::text, identifier, title FROM articles WHERE id::text = ANY(:ids)"
        ), {"ids": by_type['article']}).fetchall()
        for row in rows:
            prefix = f"{row.identifier} " if row.identifier else ""
            name_map[('article', row.id)] = f"{prefix}{row.title}"

    # Assign resolved names back to link objects
    for link in links:
        link.linked_entity_name = name_map.get(
            (link.linked_entity_type, link.linked_entity_id)
        )


def _increment_version(current_version: str) -> str:
    """Parses v1.0 -> v1.1."""
    if not current_version:
        return "v1.0"
    match = re.search(r"v?(\d+)\.(\d+)", current_version)
    if match:
        major = match.group(1)
        minor = int(match.group(2))
        return f"v{major}.{minor + 1}"
    return "v1.1"


# --- CRUD ---

@router.post("/artefacts", response_model=schemas.ArtefactResponse)
def create_artefact(
    artefact: schemas.ArtefactCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    data = artefact.model_dump()
    # Map schema 'metadata' to model attribute 'artefact_metadata'
    if 'metadata' in data:
        data['artefact_metadata'] = data.pop('metadata')
    new = models.Artefact(**data, created_by=current_user.id)
    db.add(new)
    db.commit()
    db.refresh(new)
    if new.account:
        new.account_name = new.account.name
    if new.creator:
        new.creator_name = new.creator.full_name
    return _attach_transitions(new)


@router.get("/artefacts", response_model=List[schemas.ArtefactResponse])
def list_artefacts(
    account_id: Optional[str] = None,
    artefact_type: Optional[str] = None,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    try:
        query = db.query(models.Artefact).options(
            joinedload(models.Artefact.account),
            joinedload(models.Artefact.creator),
            joinedload(models.Artefact.links),
        ).filter(models.Artefact.is_deleted == False)

        if account_id:
            query = query.filter(models.Artefact.account_id == account_id)
        if artefact_type:
            query = query.filter(models.Artefact.artefact_type == artefact_type)

        artefacts = query.order_by(models.Artefact.created_at.desc()).all()
        for a in artefacts:
            a.account_name = a.account.name if a.account else None
            a.creator_name = a.creator.full_name if a.creator else None
            _enrich_links(db, a.links)
            _attach_transitions(a)
        result = jsonable_encoder([schemas.ArtefactResponse.model_validate(a) for a in artefacts])
        for item in result:
            item.pop("content", None)
            item.pop("description", None)
        return JSONResponse(content=result)
    except Exception:
        db.rollback()
        return JSONResponse(content=[])


@router.get("/artefacts/{artefact_id}", response_model=schemas.ArtefactResponse)
def get_artefact(
    artefact_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    expand: ExpandConfig = Depends(get_expand_config),
    db: Session = Depends(get_db),
):
    artefact = db.query(models.Artefact).options(
        joinedload(models.Artefact.account),
        joinedload(models.Artefact.creator),
        joinedload(models.Artefact.links),
    ).filter(models.Artefact.id == artefact_id).first()
    if not artefact:
        raise HTTPException(status_code=404, detail="Artefact not found")
    artefact.account_name = artefact.account.name if artefact.account else None
    artefact.creator_name = artefact.creator.full_name if artefact.creator else None
    _enrich_links(db, artefact.links)
    _attach_transitions(artefact)
    result = jsonable_encoder(schemas.ArtefactResponse.model_validate(artefact))
    return expanded_response(result, expand, "artefact")


@router.get("/artefacts/{artefact_id}/sections")
def get_artefact_sections(
    artefact_id: str,
    section: Optional[str] = None,
    index: int = 0,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """List section headings, or return a single section body if ?section= is provided."""
    from ..services.section_parser import get_headings, get_section as _get_section

    artefact = db.query(models.Artefact).filter(models.Artefact.id == artefact_id).first()
    if not artefact:
        raise HTTPException(status_code=404, detail="Artefact not found")

    content = artefact.content or ""
    if section:
        result = _get_section(content, section, index=index)
        if not result:
            raise HTTPException(status_code=404, detail=f"Section not found: {section}")
        return schemas.SectionDetail(
            heading=result.heading, level=result.level,
            index=result.index, body=result.body,
        )

    headings = get_headings(content)
    return [
        schemas.SectionHeading(heading=h.heading, level=h.level, index=h.index)
        for h in headings
    ]


@router.put("/artefacts/{artefact_id}", response_model=schemas.ArtefactResponse)
def update_artefact(
    artefact_id: str,
    update: schemas.ArtefactUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    artefact = db.query(models.Artefact).filter(models.Artefact.id == artefact_id).first()
    if not artefact:
        raise HTTPException(status_code=404, detail="Artefact not found")

    update_data = update.model_dump(exclude_unset=True)
    change_comment = update_data.pop("change_comment", None)

    current_status = artefact.status or 'draft'

    # 0. AUTO-SUPERSEDED: setting superseded_by auto-sets status
    if "superseded_by" in update_data and update_data["superseded_by"] is not None:
        update_data["status"] = "superseded"

    # 1. STATUS TRANSITION VALIDATION
    if "status" in update_data and update_data["status"] != current_status:
        new_status = update_data["status"]
        allowed = _get_available_transitions(current_status)
        if new_status not in allowed:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid status transition: '{current_status}' → '{new_status}'. "
                       f"Valid transitions from '{current_status}': {allowed}"
            )

    # 2. HISTORY SNAPSHOT — only when content changes
    content_changing = "content" in update_data and update_data["content"] != artefact.content
    if content_changing:
        old_content = artefact.content
        history_entry = models.ArtefactHistory(
            artefact_id=artefact.id,
            name=artefact.name,
            content=artefact.content,
            version=artefact.version or "v1.0",
            author_id=current_user.id,
            author_name=current_user.full_name if hasattr(current_user, 'full_name') else None,
            change_comment=change_comment,
            diff_before=old_content,
            diff_after=update_data["content"],
        )
        db.add(history_entry)
        artefact.version = _increment_version(artefact.version)

    # 3. APPLY UPDATE
    for field, value in update_data.items():
        attr = 'artefact_metadata' if field == 'metadata' else field
        setattr(artefact, attr, value)

    db.commit()
    db.refresh(artefact)
    artefact.account_name = artefact.account.name if artefact.account else None
    artefact.creator_name = artefact.creator.full_name if artefact.creator else None
    _enrich_links(db, artefact.links)
    return _attach_transitions(artefact)


@router.delete("/artefacts/{artefact_id}")
def delete_artefact(
    artefact_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    artefact = db.query(models.Artefact).filter(models.Artefact.id == artefact_id).first()
    if not artefact:
        raise HTTPException(status_code=404, detail="Artefact not found")
    artefact.is_deleted = True
    db.commit()
    return {"status": "archived"}


# --- HISTORY ---

@router.get("/artefacts/{artefact_id}/history", response_model=schemas.Page[schemas.ArtefactHistoryResponse])
def get_artefact_history(
    artefact_id: str,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    query = db.query(models.ArtefactHistory).filter(
        models.ArtefactHistory.artefact_id == artefact_id
    )
    total = query.count()
    items = query.order_by(models.ArtefactHistory.snapshot_at.desc())\
        .offset((page - 1) * page_size).limit(page_size).all()
    return schemas.Page(
        total=total,
        page=page,
        page_size=page_size,
        items=items
    )


@router.post("/artefacts/{artefact_id}/revert/{history_id}", response_model=schemas.ArtefactResponse)
def revert_artefact(
    artefact_id: str,
    history_id: str,
    revert_request: schemas.ArtefactRevertRequest = None,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    artefact = db.query(models.Artefact).filter(models.Artefact.id == artefact_id).first()
    if not artefact:
        raise HTTPException(status_code=404, detail="Artefact not found")

    history_entry = db.query(models.ArtefactHistory).filter(
        models.ArtefactHistory.id == history_id,
        models.ArtefactHistory.artefact_id == artefact_id,
    ).first()
    if not history_entry:
        raise HTTPException(status_code=404, detail="History entry not found for this artefact")

    fields = (revert_request.fields if revert_request and revert_request.fields else ["content", "name"])
    valid_fields = {"content", "name"}
    if not set(fields).issubset(valid_fields):
        raise HTTPException(status_code=400, detail=f"Invalid fields. Allowed: {valid_fields}")

    # 1. SNAPSHOT current state before revert
    default_comment = f"Reverted to {history_entry.version}"
    change_comment = (revert_request.change_comment if revert_request and revert_request.change_comment else default_comment)
    snapshot = models.ArtefactHistory(
        artefact_id=artefact.id,
        name=artefact.name,
        content=artefact.content,
        version=artefact.version or "v1.0",
        author_id=current_user.id,
        author_name=current_user.full_name if hasattr(current_user, 'full_name') else None,
        change_comment=change_comment,
        diff_before=artefact.content,
        diff_after=history_entry.content if "content" in fields else artefact.content,
    )
    db.add(snapshot)

    # 2. APPLY REVERT
    if "content" in fields:
        artefact.content = history_entry.content
    if "name" in fields:
        artefact.name = history_entry.name

    # 3. VERSION BUMP
    artefact.version = _increment_version(artefact.version)

    db.commit()
    db.refresh(artefact)
    artefact.account_name = artefact.account.name if artefact.account else None
    artefact.creator_name = artefact.creator.full_name if artefact.creator else None
    _enrich_links(db, artefact.links)
    return _attach_transitions(artefact)


# --- LINK / UNLINK ---

@router.post("/artefacts/{artefact_id}/link")
def link_artefact(
    artefact_id: str,
    payload: dict,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    entity_type = payload.get("entity_type")
    entity_id = payload.get("entity_id")
    if not entity_type or not entity_id:
        raise HTTPException(status_code=422, detail="entity_type and entity_id required")
    if entity_type not in ("ticket", "account", "article", "project", "milestone"):
        raise HTTPException(status_code=422, detail="entity_type must be ticket, account, article, project, or milestone")

    # Check artefact exists
    artefact = db.query(models.Artefact).filter(models.Artefact.id == artefact_id).first()
    if not artefact:
        raise HTTPException(status_code=404, detail="Artefact not found")

    # Check for existing link
    existing = db.query(models.ArtefactLink).filter(
        models.ArtefactLink.artefact_id == artefact_id,
        models.ArtefactLink.linked_entity_type == entity_type,
        models.ArtefactLink.linked_entity_id == entity_id,
    ).first()
    if existing:
        return {"status": "already_exists"}

    link = models.ArtefactLink(
        artefact_id=artefact_id,
        linked_entity_type=entity_type,
        linked_entity_id=entity_id,
    )
    db.add(link)
    db.commit()
    return {"status": "linked"}


@router.delete("/artefacts/{artefact_id}/link/{entity_type}/{entity_id}")
def unlink_artefact(
    artefact_id: str,
    entity_type: str,
    entity_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    link = db.query(models.ArtefactLink).filter(
        models.ArtefactLink.artefact_id == artefact_id,
        models.ArtefactLink.linked_entity_type == entity_type,
        models.ArtefactLink.linked_entity_id == entity_id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()
    return {"status": "unlinked"}


# --- REVERSE LOOKUPS ---

@router.get("/tickets/{ticket_id}/artefacts", response_model=List[schemas.ArtefactLite])
def ticket_artefacts(
    ticket_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    artefact_ids = db.query(models.ArtefactLink.artefact_id).filter(
        models.ArtefactLink.linked_entity_type == "ticket",
        models.ArtefactLink.linked_entity_id == str(ticket_id),
    ).all()
    ids = [r[0] for r in artefact_ids]
    if not ids:
        return []
    return db.query(models.Artefact).filter(
        models.Artefact.id.in_(ids),
        models.Artefact.is_deleted == False,
    ).all()


@router.get("/accounts/{account_id}/artefacts", response_model=List[schemas.ArtefactLite])
def account_artefacts(
    account_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    artefact_ids = db.query(models.ArtefactLink.artefact_id).filter(
        models.ArtefactLink.linked_entity_type == "account",
        models.ArtefactLink.linked_entity_id == account_id,
    ).all()
    ids = [r[0] for r in artefact_ids]
    if not ids:
        return []
    return db.query(models.Artefact).filter(
        models.Artefact.id.in_(ids),
        models.Artefact.is_deleted == False,
    ).all()


@router.get("/articles/{article_id}/artefacts", response_model=List[schemas.ArtefactLite])
def article_artefacts(
    article_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    artefact_ids = db.query(models.ArtefactLink.artefact_id).filter(
        models.ArtefactLink.linked_entity_type == "article",
        models.ArtefactLink.linked_entity_id == article_id,
    ).all()
    ids = [r[0] for r in artefact_ids]
    if not ids:
        return []
    return db.query(models.Artefact).filter(
        models.Artefact.id.in_(ids),
        models.Artefact.is_deleted == False,
    ).all()
