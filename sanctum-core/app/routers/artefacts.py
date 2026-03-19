from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(tags=["Artefacts"])


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
    return new


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
        return artefacts
    except Exception:
        db.rollback()
        return []


@router.get("/artefacts/{artefact_id}", response_model=schemas.ArtefactResponse)
def get_artefact(
    artefact_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
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
    return artefact


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
    for field, value in update.model_dump(exclude_unset=True).items():
        # Map schema 'metadata' to model attribute 'artefact_metadata'
        attr = 'artefact_metadata' if field == 'metadata' else field
        setattr(artefact, attr, value)
    db.commit()
    db.refresh(artefact)
    artefact.account_name = artefact.account.name if artefact.account else None
    artefact.creator_name = artefact.creator.full_name if artefact.creator else None
    return artefact


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
    if entity_type not in ("ticket", "account", "article"):
        raise HTTPException(status_code=422, detail="entity_type must be ticket, account, or article")

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
