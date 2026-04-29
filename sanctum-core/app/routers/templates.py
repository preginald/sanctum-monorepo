from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from .. import models, auth
from ..database import get_db
from ..schemas.templates import (
    TemplateCreate, TemplateUpdate, TemplateResponse, TemplateImport,
    TemplateApply, TemplateApplyResponse, TemplateClone,
    TemplateSectionCreate, TemplateSectionUpdate, TemplateSectionResponse,
    TemplateItemCreate, TemplateItemUpdate, TemplateItemResponse,
    TemplateApplicationResponse,
)
from ..services.event_bus import event_bus
from ..services.uuid_resolver import get_or_404 as _resolve_or_404, resolve_uuid
import uuid

router = APIRouter(prefix="/templates", tags=["Template Library"])


# ─────────────────────────────────────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────────────────────────────────────

def _enrich(template: models.Template, db: Session) -> models.Template:
    """Attach computed fields to a template ORM object before serialisation."""
    template.section_count = len(template.sections)
    template.item_count = sum(len(s.items) for s in template.sections)
    if template.source_template_id:
        source = db.query(models.Template).filter(
            models.Template.id == template.source_template_id
        ).first()
        template.cloned_from_name = source.name if source else None
    else:
        template.cloned_from_name = None
    return template


def _get_or_404(template_id: str, db: Session) -> models.Template:
    return _resolve_or_404(db, models.Template, template_id, options=[
        joinedload(models.Template.sections).joinedload(models.TemplateSection.items)
    ], deleted_filter=False)


def _shift_section_sequences(template_id: str, target_sequence: int, db: Session) -> None:
    """Shift existing sections at *target_sequence* or above up by one.

    Called before inserting a new section so the new row can occupy
    *target_sequence* without a collision.  If no section occupies the
    target position this is a no-op.
    """
    sections = (
        db.query(models.TemplateSection)
        .filter(
            models.TemplateSection.template_id == template_id,
            models.TemplateSection.sequence >= target_sequence,
        )
        .order_by(models.TemplateSection.sequence.desc())
        .all()
    )
    for s in sections:
        s.sequence += 1
    db.flush()


# ─────────────────────────────────────────────────────────────────────────────
# LIST & GET
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[TemplateResponse])
def list_templates(
    template_type: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all templates, with optional type/category/status filters."""
    q = db.query(models.Template).options(
        joinedload(models.Template.sections).joinedload(models.TemplateSection.items)
    )
    if template_type:
        q = q.filter(models.Template.template_type == template_type)
    if category:
        q = q.filter(models.Template.category == category)
    if is_active is not None:
        q = q.filter(models.Template.is_active == is_active)
    templates = q.order_by(models.Template.created_at.desc()).all()
    return [_enrich(t, db) for t in templates]


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Get a single template with full section + item tree."""
    return _enrich(_get_or_404(template_id, db), db)


# ─────────────────────────────────────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", response_model=TemplateResponse, status_code=201)
def create_template(
    payload: TemplateCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new template with optional nested sections and items."""
    if current_user.role == "client":
        raise HTTPException(status_code=403, detail="Forbidden")

    template = models.Template(
        name=payload.name,
        description=payload.description,
        template_type=payload.template_type,
        category=payload.category,
        tags=payload.tags or [],
        icon=payload.icon,
        created_by_id=current_user.id,
    )
    db.add(template)
    db.flush()  # get template.id before adding children

    used_sequences = set()
    for sec_idx, sec_data in enumerate(payload.sections or []):
        seq = sec_data.sequence if sec_data.sequence else sec_idx + 1
        while seq in used_sequences:
            seq += 1
        used_sequences.add(seq)
        section = models.TemplateSection(
            template_id=template.id,
            name=sec_data.name,
            description=sec_data.description,
            sequence=seq,
        )
        db.add(section)
        db.flush()

        for item_idx, item_data in enumerate(sec_data.items or []):
            item = models.TemplateItem(
                section_id=section.id,
                subject=item_data.subject,
                description=item_data.description,
                item_type=item_data.item_type,
                priority=item_data.priority,
                sequence=item_data.sequence if item_data.sequence else item_idx + 1,
                config=item_data.config or {},
            )
            db.add(item)

    db.commit()
    db.refresh(template)
    return _enrich(_get_or_404(str(template.id), db), db)


# ─────────────────────────────────────────────────────────────────────────────
# IMPORT FROM JSON
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/import", response_model=TemplateResponse, status_code=201)
def import_template(
    payload: TemplateImport,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Import a template from portable JSON.
    Identical to create — named separately for intent clarity in the UI.
    """
    if current_user.role == "client":
        raise HTTPException(status_code=403, detail="Forbidden")
    # Reuse create logic via TemplateCreate (same shape)
    return create_template(
        payload=TemplateCreate(**payload.model_dump()),
        current_user=current_user,
        db=db,
    )


# ─────────────────────────────────────────────────────────────────────────────
# EXPORT TO JSON
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{template_id}/export")
def export_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """
    Export a template as portable JSON suitable for import elsewhere.
    Strips IDs and timestamps — only portable content is returned.
    """
    t = _get_or_404(template_id, db)
    return {
        "name": t.name,
        "description": t.description,
        "template_type": t.template_type,
        "category": t.category,
        "tags": t.tags,
        "icon": t.icon,
        "sections": [
            {
                "name": s.name,
                "description": s.description,
                "sequence": s.sequence,
                "items": [
                    {
                        "subject": i.subject,
                        "description": i.description,
                        "item_type": i.item_type,
                        "priority": i.priority,
                        "sequence": i.sequence,
                        "config": i.config,
                    }
                    for i in s.items
                ],
            }
            for s in t.sections
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE & SOFT DELETE
# ─────────────────────────────────────────────────────────────────────────────

@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: str,
    payload: TemplateUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update top-level template metadata (name, description, category, tags, icon, is_active)."""
    if current_user.role == "client":
        raise HTTPException(status_code=403, detail="Forbidden")
    t = _get_or_404(template_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return _enrich(_get_or_404(template_id, db), db)


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Soft-delete: sets is_active=False.
    Hard delete is blocked if template has ever been applied (times_applied > 0).
    """
    if current_user.role == "client":
        raise HTTPException(status_code=403, detail="Forbidden")
    t = _get_or_404(template_id, db)
    if t.times_applied > 0:
        # Safe soft-delete only
        t.is_active = False
        db.commit()
    else:
        db.delete(t)
        db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# CLONE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{template_id}/clone", response_model=TemplateResponse, status_code=201)
def clone_template(
    template_id: str,
    payload: TemplateClone,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Deep-clone a template (sections + items) under a new name.
    Populates source_template_id for lineage tracking.
    """
    if current_user.role == "client":
        raise HTTPException(status_code=403, detail="Forbidden")

    source = _get_or_404(template_id, db)

    clone = models.Template(
        name=payload.name,
        description=source.description,
        template_type=source.template_type,
        category=source.category,
        tags=list(source.tags or []),
        icon=source.icon,
        source_template_id=source.id,
        created_by_id=current_user.id,
    )
    db.add(clone)
    db.flush()

    for section in source.sections:
        new_section = models.TemplateSection(
            template_id=clone.id,
            name=section.name,
            description=section.description,
            sequence=section.sequence,
        )
        db.add(new_section)
        db.flush()

        for item in section.items:
            new_item = models.TemplateItem(
                section_id=new_section.id,
                subject=item.subject,
                description=item.description,
                item_type=item.item_type,
                priority=item.priority,
                sequence=item.sequence,
                config=dict(item.config or {}),
            )
            db.add(new_item)

    db.commit()
    db.refresh(clone)
    return _enrich(_get_or_404(str(clone.id), db), db)


# ─────────────────────────────────────────────────────────────────────────────
# APPLY (scaffold real entities from template)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{template_id}/apply", response_model=TemplateApplyResponse, status_code=201)
def apply_template(
    template_id: str,
    payload: TemplateApply,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Atomically scaffold real entities from a template.

    For template_type="project":
      - Creates a Project
      - Creates a Milestone per TemplateSection
      - Creates a Ticket per TemplateItem (linked to milestone)
      - Logs application in TemplateApplication
      - Increments times_applied
    """
    if current_user.role == "client":
        raise HTTPException(status_code=403, detail="Forbidden")

    t = _get_or_404(template_id, db)

    if t.template_type == "project":
        entity_id, entity_name, milestones_created, tickets_created = _apply_project(
            t, payload, current_user, db
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Apply not yet supported for template_type='{t.template_type}'"
        )

    # Log + increment
    log = models.TemplateApplication(
        template_id=t.id,
        applied_by_id=current_user.id,
        account_id=payload.account_id,
        entity_type=t.template_type,
        entity_id=entity_id,
    )
    db.add(log)
    t.times_applied = (t.times_applied or 0) + 1
    db.commit()

    # Pre-check: surface warnings for audit templates (AC #7)
    warnings = []
    if t.category == "audit":
        account = db.query(models.Account).filter(
            models.Account.id == payload.account_id
        ).first()
        if account and not account.website:
            warnings.append(
                f"No website URL on record for {account.name}. "
                f"The baseline audit scan will be skipped. "
                f"Add a URL to the account and retry manually."
            )

    # Emit template_applied event for subscribers (e.g. audit scan trigger)
    event_bus.emit("template_applied", {
        "template_id": str(t.id),
        "template_name": t.name,
        "template_category": t.category,
        "entity_type": t.template_type,
        "entity_id": str(entity_id),
        "account_id": str(payload.account_id),
    }, background_tasks)

    return TemplateApplyResponse(
        template_id=t.id,
        entity_type=t.template_type,
        entity_id=entity_id,
        entity_name=entity_name,
        milestones_created=milestones_created,
        tickets_created=tickets_created,
        warnings=warnings,
    )


def _substitute(text: str | None, variables: dict[str, str]) -> str | None:
    """Replace {key} placeholders in text with variable values."""
    if text is None:
        return None
    for key, value in variables.items():
        text = text.replace(f"{{{key}}}", value)
    return text


def _ordered_project_template_sections(template: models.Template, max_seq: int):
    return [
        (section, sorted(list(section.items), key=lambda i: i.sequence), max_seq + idx)
        for idx, section in enumerate(
            sorted(template.sections, key=lambda s: s.sequence),
            start=1,
        )
    ]


def _add_template_ticket_mapping(ticket_map, ambiguous_keys, key, ticket_id, item):
    if key in ambiguous_keys:
        return
    if key in ticket_map:
        del ticket_map[key]
        ambiguous_keys.add(key)
        return
    ticket_map[key] = (ticket_id, item)


def _apply_project(
    template: models.Template,
    payload: TemplateApply,
    user: models.User,
    db: Session,
):
    """Create a Project + Milestones + Tickets from a project template."""
    if payload.project_id:
        project = db.query(models.Project).filter(
            models.Project.id == payload.project_id
        ).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if project.account_id != payload.account_id:
            raise HTTPException(
                status_code=400,
                detail="account_id does not match the project's account",
            )
        project.template_id = template.id
        # Offset milestone sequences to avoid collisions with existing milestones
        max_seq = db.query(func.max(models.Milestone.sequence)).filter(
            models.Milestone.project_id == project.id,
            models.Milestone.is_deleted == False,
        ).scalar() or 0
    else:
        project = models.Project(
            account_id=payload.account_id,
            name=payload.project_name or template.name,
            description=payload.project_description or template.description,
            status="planning",
        )
        db.add(project)
        db.flush()
        project.template_id = template.id
        max_seq = 0

    milestones_created = 0
    tickets_created = 0
    # Pass 1: Create milestones + tickets, build lookup map
    ticket_map = {}  # (section_seq, item_seq) -> ticket_id
    ambiguous_ticket_keys = set()

    variables = payload.variables or {}

    # Pre-materialize section items before the flush loop to prevent
    # SQLAlchemy session state changes from causing lazy re-loads that
    # return empty collections for later sections.  See #1831.
    sections_with_items = _ordered_project_template_sections(template, max_seq)

    for section, items, milestone_sequence in sections_with_items:
        milestone = models.Milestone(
            project_id=project.id,
            name=_substitute(section.name, variables) if variables else section.name,
            description=_substitute(section.description, variables) if variables else section.description,
            sequence=milestone_sequence,
            status="pending",
        )
        db.add(milestone)
        db.flush()
        milestones_created += 1

        for item in items:
            ticket = models.Ticket(
                account_id=payload.account_id,
                milestone_id=milestone.id,
                subject=_substitute(item.subject, variables) if variables else item.subject,
                description=_substitute(item.description, variables) if variables else item.description,
                ticket_type=item.item_type,
                priority=item.priority,
                status="new",
                assigned_tech_id=user.id,
            )
            db.add(ticket)
            db.flush()
            tickets_created += 1
            _add_template_ticket_mapping(
                ticket_map,
                ambiguous_ticket_keys,
                (section.sequence, item.sequence),
                ticket.id,
                item,
            )

    # Pass 2: Wire ticket relations from template item dependencies
    for (sec_seq, item_seq), (ticket_id, item) in ticket_map.items():
        deps = (item.config or {}).get("dependencies", [])
        for dep in deps:
            target_sec = dep.get("section_seq", sec_seq)
            target_item = dep.get("item_seq")
            rel_type = dep.get("relation_type", "relates_to")
            if target_item is None:
                continue
            target = ticket_map.get((target_sec, target_item))
            if target is None:
                continue
            target_ticket_id = target[0]
            db.execute(
                models.ticket_relations.insert().values(
                    ticket_id=ticket_id,
                    related_id=target_ticket_id,
                    relation_type=rel_type,
                    visibility="internal",
                )
            )

    db.flush()
    return project.id, project.name, milestones_created, tickets_created


# ─────────────────────────────────────────────────────────────────────────────
# SECTION MANAGEMENT (inline edit support)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{template_id}/sections", response_model=TemplateSectionResponse, status_code=201)
def add_section(
    template_id: str,
    payload: TemplateSectionCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    _get_or_404(template_id, db)

    _shift_section_sequences(template_id, payload.sequence, db)

    section = models.TemplateSection(
        template_id=template_id,
        name=payload.name,
        description=payload.description,
        sequence=payload.sequence,
    )
    db.add(section)
    db.flush()

    for idx, item_data in enumerate(payload.items or []):
        db.add(models.TemplateItem(
            section_id=section.id,
            subject=item_data.subject,
            description=item_data.description,
            item_type=item_data.item_type,
            priority=item_data.priority,
            sequence=item_data.sequence or idx + 1,
            config=item_data.config or {},
        ))

    db.commit()
    db.refresh(section)
    return section


@router.put("/sections/{section_id}", response_model=TemplateSectionResponse)
def update_section(
    section_id: str,
    payload: TemplateSectionUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    section = db.query(models.TemplateSection).filter(
        models.TemplateSection.id == section_id
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    old_sequence = section.sequence
    new_sequence = payload.sequence if payload.sequence is not None else old_sequence

    if new_sequence != old_sequence:
        _shift_section_sequences(section.template_id, new_sequence, db)
        section.sequence = new_sequence

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "sequence":
            continue
        setattr(section, field, value)

    db.commit()
    db.refresh(section)
    return section


@router.delete("/sections/{section_id}", status_code=204)
def delete_section(
    section_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    section = db.query(models.TemplateSection).filter(
        models.TemplateSection.id == section_id
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    db.delete(section)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# ITEM MANAGEMENT (inline edit support)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/sections/{section_id}/items", response_model=TemplateItemResponse, status_code=201)
def add_item(
    section_id: str,
    payload: TemplateItemCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    section = db.query(models.TemplateSection).filter(
        models.TemplateSection.id == section_id
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    item = models.TemplateItem(section_id=section_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/items/{item_id}", response_model=TemplateItemResponse)
def update_item(
    item_id: str,
    payload: TemplateItemUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    item = _resolve_or_404(db, models.TemplateItem, item_id, deleted_filter=False)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
def delete_item(
    item_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    item = _resolve_or_404(db, models.TemplateItem, item_id, deleted_filter=False)
    db.delete(item)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# APPLICATION LOG
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{template_id}/applications", response_model=List[TemplateApplicationResponse])
def get_applications(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Return the full application history for a template."""
    _get_or_404(template_id, db)
    return db.query(models.TemplateApplication).filter(
        models.TemplateApplication.template_id == template_id
    ).order_by(models.TemplateApplication.applied_at.desc()).all()
