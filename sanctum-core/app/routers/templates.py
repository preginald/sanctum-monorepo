from fastapi import APIRouter, Depends, HTTPException
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
    t = db.query(models.Template).options(
        joinedload(models.Template.sections).joinedload(models.TemplateSection.items)
    ).filter(models.Template.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


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

    for sec_idx, sec_data in enumerate(payload.sections or []):
        section = models.TemplateSection(
            template_id=template.id,
            name=sec_data.name,
            description=sec_data.description,
            sequence=sec_data.sequence if sec_data.sequence else sec_idx + 1,
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
        entity_id, milestones_created, tickets_created = _apply_project(
            t, payload, current_user, db
        )
        entity_name = payload.project_name or t.name
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

    return TemplateApplyResponse(
        template_id=t.id,
        entity_type=t.template_type,
        entity_id=entity_id,
        entity_name=entity_name,
        milestones_created=milestones_created,
        tickets_created=tickets_created,
    )


def _apply_project(
    template: models.Template,
    payload: TemplateApply,
    user: models.User,
    db: Session,
):
    """Create a Project + Milestones + Tickets from a project template."""
    project = models.Project(
        account_id=payload.account_id,
        name=payload.project_name or template.name,
        description=payload.project_description or template.description,
        status="planning",
    )
    db.add(project)
    db.flush()

    milestones_created = 0
    tickets_created = 0

    for section in sorted(template.sections, key=lambda s: s.sequence):
        milestone = models.Milestone(
            project_id=project.id,
            name=section.name,
            sequence=section.sequence,
            status="pending",
        )
        db.add(milestone)
        db.flush()
        milestones_created += 1

        for item in sorted(section.items, key=lambda i: i.sequence):
            ticket = models.Ticket(
                account_id=payload.account_id,
                milestone_id=milestone.id,
                subject=item.subject,
                description=item.description,
                ticket_type=item.item_type,
                priority=item.priority,
                status="new",
                assigned_tech_id=user.id,
            )
            db.add(ticket)
            tickets_created += 1

    db.flush()
    return project.id, milestones_created, tickets_created


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
    for field, value in payload.model_dump(exclude_unset=True).items():
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
    item = db.query(models.TemplateItem).filter(models.TemplateItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
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
    item = db.query(models.TemplateItem).filter(models.TemplateItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
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
