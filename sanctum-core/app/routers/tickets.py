from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text as sa_text
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db
from ..services.event_bus import event_bus
from ..services.notification_service import notification_service
from ..services.ticket_validation import validate_ticket_description, validate_ticket_transition, get_available_transitions, validate_ticket_type, validate_ticket_priority, auto_transition_from_new, SUBSTANTIVE_FIELDS
from ..services.ticket_query import base_ticket_query, enrich_ticket_response
from ..services.milestone_validation import validate_milestone_sealed, check_milestone_completion_advisory
from ..services.cascade import cascade_from_ticket

router = APIRouter(prefix="/tickets", tags=["Tickets"])

@router.get("", response_model=List[schemas.TicketResponse])
def get_tickets(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = base_ticket_query(db)\
        .join(models.Account)\
        .filter(models.Ticket.is_deleted == False)

    if current_user.access_scope == 'nt_only':
        query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only':
        query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))

    if current_user.role == 'client':
        query = query.filter(models.Ticket.account_id == current_user.account_id)

    tickets = query.order_by(models.Ticket.id.desc()).all()
    return [enrich_ticket_response(t, db) for t in tickets]

@router.post("", response_model=schemas.TicketResponse)
def create_ticket(
    ticket: schemas.TicketCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    target_account_id = ticket.account_id
    if current_user.role == 'client':
        target_account_id = current_user.account_id
        ticket.assigned_tech_id = None
        ticket.milestone_id = None
        if not ticket.ticket_type: ticket.ticket_type = 'support'

        linked_contact = db.query(models.Contact).filter(models.Contact.account_id == current_user.account_id, models.Contact.email == current_user.email).first()
        if linked_contact and linked_contact.id not in ticket.contact_ids:
            ticket.contact_ids.append(linked_contact.id)

    if not ticket.skip_validation:
        validate_ticket_type(ticket.ticket_type, db)
        validate_ticket_priority(ticket.priority, db)
        validate_ticket_description(ticket.ticket_type, ticket.description)
        validate_milestone_sealed(ticket.milestone_id, db)

    new_ticket = models.Ticket(
        account_id=target_account_id, subject=ticket.subject, description=ticket.description,
        priority=ticket.priority, status='new', assigned_tech_id=ticket.assigned_tech_id,
        ticket_type=ticket.ticket_type, milestone_id=ticket.milestone_id
    )

    if ticket.contact_ids:
        new_ticket.contacts = db.query(models.Contact).filter(models.Contact.id.in_(ticket.contact_ids)).all()

    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    new_ticket.account = db.query(models.Account).filter(models.Account.id == target_account_id).first()
    new_ticket.account_name = new_ticket.account.name

    new_ticket.related_tickets = []
    event_bus.emit("ticket_created", new_ticket, background_tasks)

    if new_ticket.assigned_tech_id:
        tech = db.query(models.User).filter(models.User.id == new_ticket.assigned_tech_id).first()
        if tech:
            notification_service.enqueue(
                db,
                recipients=[{"type": "user", "user_id": str(tech.id), "email": tech.email}],
                subject=f"New Assignment: #{new_ticket.id}",
                message=f"You have been assigned to: {new_ticket.subject} ({new_ticket.account_name})",
                link=f"/tickets/{new_ticket.id}",
                priority=new_ticket.priority
            )

    return new_ticket


@router.get("/{ticket_id}", response_model=schemas.TicketResponse)
def get_ticket_by_id(ticket_id: int, resolve_embeds: bool = False, db: Session = Depends(get_db)):
    ticket = base_ticket_query(db).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    t_dict = enrich_ticket_response(ticket, db)
    t_dict['related_tickets'] = []
    response_data = schemas.TicketResponse.model_validate(t_dict)

    # Build related_tickets from ticket_relations join table (both directions)
    relations_raw = db.execute(sa_text("""
        SELECT t.id, t.subject, t.status, t.priority, t.ticket_type,
               tr.relation_type, tr.visibility,
               tr.ticket_id as source_id
        FROM ticket_relations tr
        JOIN tickets t ON (
            CASE WHEN tr.ticket_id = :tid THEN tr.related_id ELSE tr.ticket_id END = t.id
        )
        WHERE tr.ticket_id = :tid OR tr.related_id = :tid
    """), {"tid": ticket_id}).fetchall()

    related = []
    for row in relations_raw:
        relation_type = row.relation_type
        if row.relation_type == "blocks" and row.source_id != ticket_id:
            relation_type = "blocked_by"
        elif row.relation_type == "duplicates" and row.source_id != ticket_id:
            relation_type = "duplicate_of"
        related.append(schemas.TicketRelationResponse(
            id=row.id,
            subject=row.subject,
            status=row.status,
            priority=row.priority,
            ticket_type=row.ticket_type,
            relation_type=relation_type,
            visibility=row.visibility
        ))
    response_data.related_tickets = related

    # Load linked artefacts (graceful if table doesn't exist yet)
    try:
        artefact_ids = db.query(models.ArtefactLink.artefact_id).filter(
            models.ArtefactLink.linked_entity_type == "ticket",
            models.ArtefactLink.linked_entity_id == str(ticket_id),
        ).all()
        if artefact_ids:
            ids = [r[0] for r in artefact_ids]
            response_data.artefacts = db.query(models.Artefact).filter(
                models.Artefact.id.in_(ids), models.Artefact.is_deleted == False
            ).all()
    except Exception:
        db.rollback()

    if resolve_embeds:
        try:
            from ..services.content_engine import resolve_content
            if response_data.description:
                response_data.resolved_description = resolve_content(db, response_data.description)
            for comment in response_data.comments:
                if comment.body:
                    comment.resolved_body = resolve_content(db, comment.body)
        except Exception as e:
            print(f"Content Engine failed: {e}")

    return response_data

@router.put("/{ticket_id}", response_model=schemas.TicketResponse)
def update_ticket(
    ticket_id: int,
    ticket_update: schemas.TicketUpdate,
    background_tasks: BackgroundTasks,
    resolve_embeds: bool = False, db: Session = Depends(get_db)
):
    ticket = base_ticket_query(db).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")
    update_data = ticket_update.model_dump(exclude_unset=True)

    # Type/priority validation on update
    if not ticket_update.skip_validation and 'ticket_type' in update_data:
        validate_ticket_type(update_data['ticket_type'], db)
    if not ticket_update.skip_validation and 'priority' in update_data:
        validate_ticket_priority(update_data['priority'], db)

    # Description validation on update
    if not ticket_update.skip_validation and ('description' in update_data or 'ticket_type' in update_data):
        effective_type = update_data.get('ticket_type', ticket.ticket_type)
        effective_desc = update_data.get('description', ticket.description)
        validate_ticket_description(effective_type, effective_desc)

    # Status transition validation
    if not ticket_update.skip_validation and 'status' in update_data and update_data['status'] != ticket.status:
        validate_ticket_transition(ticket.status, update_data['status'], db)

    # Resolution comment enforcement
    if not ticket_update.skip_validation and update_data.get('status') == 'resolved' and ticket.status != 'resolved':
        resolution_id = update_data.get('resolution_comment_id') or ticket.resolution_comment_id
        if not resolution_id:
            raise HTTPException(
                status_code=422,
                detail="Resolution requires a resolution comment. See SYS-005."
            )

    # Time entry enforcement (BUS-001 D2/D7)
    if not ticket_update.skip_validation and update_data.get('status') == 'resolved' and ticket.status != 'resolved':
        if ticket.total_hours == 0 and not (update_data.get('no_billable') or ticket.no_billable):
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": "time_entry_required: log time entries or set no_billable before resolving",
                    "error_code": "time_entry_required",
                    "total_hours": 0,
                    "help": "Log time entries on this ticket, or set no_billable=true with a reason. See BUS-001 D2.",
                },
            )

    # Budget enforcement (BUS-001 D3/D7)
    if not ticket_update.skip_validation and update_data.get('status') == 'resolved' and ticket.status != 'resolved':
        if ticket.milestone and ticket.milestone.project:
            project = ticket.milestone.project
            if project.market_value is None and project.quoted_price is None:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "detail": f"project_budget_required: set market_value or quoted_price on project '{project.name}' before resolving tickets",
                        "error_code": "project_budget_required",
                        "project_id": str(project.id),
                        "project_name": project.name,
                        "help": "Set market_value or quoted_price on the project. See BUS-001 D3.",
                    },
                )
            # Discount register enforcement (BUS-001 D5/D7)
            if (project.market_value is not None and project.quoted_price is not None
                    and project.quoted_price < project.market_value
                    and not (project.discount_reason or '').strip()):
                discount_amount = project.market_value - project.quoted_price
                raise HTTPException(
                    status_code=422,
                    detail={
                        "detail": f"discount_reason_required: quoted_price is ${discount_amount:,.2f} below market_value on project '{project.name}' — set a discount_reason before resolving tickets",
                        "error_code": "discount_reason_required",
                        "project_id": str(project.id),
                        "project_name": project.name,
                        "discount_amount": str(discount_amount),
                        "help": "Set discount_reason on the project (e.g. 'launch support', 'gift'). See BUS-001 D5.",
                    },
                )

    # No-billable reason enforcement
    if update_data.get('no_billable') and not (update_data.get('no_billable_reason') or '').strip():
        raise HTTPException(
            status_code=422,
            detail="no_billable_reason is required when no_billable is true."
        )

    # Sealed milestone check — reject assignment to completed milestones
    if not ticket_update.skip_validation and 'milestone_id' in update_data:
        new_milestone_id = update_data['milestone_id']
        if new_milestone_id and new_milestone_id != ticket.milestone_id:
            validate_milestone_sealed(new_milestone_id, db)

    # Auto-transition from 'new' → 'open' on substantive field changes (#774)
    if ticket.status == 'new' and 'status' not in update_data:
        if SUBSTANTIVE_FIELDS & set(update_data.keys()):
            auto_transition_from_new(ticket, db)

    was_resolved = ticket.status == 'resolved'
    old_status = ticket.status
    old_tech_id = ticket.assigned_tech_id

    # 1. HANDLE MANY-TO-MANY CONTACTS
    if 'contact_ids' in update_data:
        ids = update_data.pop('contact_ids')
        if ids:
            ticket.contacts = db.query(models.Contact).filter(models.Contact.id.in_(ids)).all()
        else:
            ticket.contacts = []

    # 2. STATUS CHECK
    if 'status' in update_data and update_data['status'] == 'resolved' and ticket.status != 'resolved':
        if 'closed_at' not in update_data: ticket.closed_at = func.now()

    # 3. GENERIC FIELDS
    for key, value in update_data.items(): setattr(ticket, key, value)

    # 4. CASCADE: ticket status change → milestone → project
    if ticket.status != old_status and ticket.milestone_id:
        cascade_from_ticket(ticket, db)

    db.commit()

    # Re-query with full joinedloads after commit to get fresh state
    ticket = base_ticket_query(db).filter(models.Ticket.id == ticket_id).first()

    # 4. NOTIFY: ASSIGNMENT CHANGE
    if ticket.assigned_tech_id and ticket.assigned_tech_id != old_tech_id:
        tech = db.query(models.User).filter(models.User.id == ticket.assigned_tech_id).first()
        if tech:
            notification_service.enqueue(
                db,
                recipients=[{ 'type': 'user', 'user_id': tech.id, 'email': tech.email }],
                subject=f"Assignment Update: #{ticket.id}",
                message=f"You have been assigned to ticket: {ticket.subject}",
                link=f"/tickets/{ticket.id}",
                priority=ticket.priority,
                event_payload={ 'event_type': 'ticket_assigned', 'ticket_id': ticket.id }
            )

    # 5. NOTIFY: RESOLUTION
    if ticket.status == 'resolved' and not was_resolved:
        event_bus.emit("ticket_resolved", ticket, background_tasks)

    t_dict = enrich_ticket_response(ticket, db)
    t_dict['related_tickets'] = []
    response_data = schemas.TicketResponse.model_validate(t_dict)

    # Completion advisory — hint when resolving the last open ticket in a milestone
    if ticket.status == 'resolved' and not was_resolved and ticket.milestone_id:
        advisory = check_milestone_completion_advisory(ticket.milestone_id, db)
        if advisory:
            response_data.milestone_completion_ready = advisory["milestone_completion_ready"]
            response_data.milestone_completion_message = advisory["milestone_completion_message"]

    if resolve_embeds:
        try:
            from ..services.content_engine import resolve_content
            if response_data.description:
                response_data.resolved_description = resolve_content(db, response_data.description)
            for comment in response_data.comments:
                if comment.body:
                    comment.resolved_body = resolve_content(db, comment.body)
        except Exception as e:
            print(f"CRITICAL: Content Engine failed on save: {e}")

    return response_data

@router.delete("/{ticket_id}")
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    tick = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not tick: raise HTTPException(status_code=404, detail="Ticket not found")
    tick.is_deleted = True
    if tick.milestone_id:
        cascade_from_ticket(tick, db)
    db.commit()
    return {"status": "archived"}

# --- SUB-ITEMS (Time/Material/Links) ---

@router.post("/{ticket_id}/time_entries", response_model=schemas.TimeEntryResponse)
def create_time_entry(ticket_id: int, entry: schemas.TimeEntryCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")
    # Minimum billing increment: 15 minutes (BUS-001 D4)
    duration_minutes = (entry.end_time - entry.start_time).total_seconds() / 60
    if duration_minutes < 15:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": f"minimum_increment: time entry is {duration_minutes:.0f} minutes — minimum billing increment is 15 minutes (0.25 hours)",
                "error_code": "minimum_increment",
                "duration_minutes": round(duration_minutes),
                "help": "Adjust start_time or end_time so the entry is at least 15 minutes. See BUS-001 D4.",
            },
        )
    new_entry = models.TicketTimeEntry(
        ticket_id=ticket_id, user_id=current_user.id, start_time=entry.start_time, end_time=entry.end_time, description=entry.description, product_id=entry.product_id
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    new_entry.user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if entry.product_id: new_entry.product = db.query(models.Product).filter(models.Product.id == entry.product_id).first()
    return new_entry

@router.put("/time_entries/{entry_id}", response_model=schemas.TimeEntryResponse)
def update_time_entry(entry_id: str, update: schemas.TimeEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.id == entry_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Entry not found")
    if update.start_time: entry.start_time = update.start_time
    if update.end_time: entry.end_time = update.end_time
    # Minimum billing increment check after applying time changes (BUS-001 D4)
    if update.start_time or update.end_time:
        duration_minutes = (entry.end_time - entry.start_time).total_seconds() / 60
        if duration_minutes < 15:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": f"minimum_increment: time entry is {duration_minutes:.0f} minutes — minimum billing increment is 15 minutes (0.25 hours)",
                    "error_code": "minimum_increment",
                    "duration_minutes": round(duration_minutes),
                    "help": "Adjust start_time or end_time so the entry is at least 15 minutes. See BUS-001 D4.",
                },
            )
    if update.description is not None: entry.description = update.description
    if update.product_id: entry.product_id = update.product_id
    db.commit()
    db.refresh(entry)
    return entry

@router.delete("/{ticket_id}/time_entries/{entry_id}")
def delete_time_entry(ticket_id: int, entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.id == entry_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"status": "deleted"}

@router.post("/time_entries/{entry_id}/duplicate", response_model=schemas.TimeEntryResponse)
def duplicate_time_entry(entry_id: str, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    original = db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.id == entry_id).first()
    if not original: raise HTTPException(status_code=404, detail="Entry not found")
    new_entry = models.TicketTimeEntry(
        ticket_id=original.ticket_id, user_id=current_user.id, product_id=original.product_id,
        start_time=original.start_time, end_time=original.end_time, description=original.description
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    new_entry.user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if new_entry.product_id: new_entry.product = db.query(models.Product).filter(models.Product.id == new_entry.product_id).first()
    return new_entry

@router.post("/{ticket_id}/materials", response_model=schemas.TicketMaterialResponse)
def add_ticket_material(ticket_id: int, material: schemas.TicketMaterialCreate, db: Session = Depends(get_db)):
    new_mat = models.TicketMaterial(ticket_id=ticket_id, product_id=material.product_id, quantity=material.quantity)
    db.add(new_mat)
    db.commit()
    db.refresh(new_mat)
    new_mat.product = db.query(models.Product).filter(models.Product.id == material.product_id).first()
    return new_mat

@router.put("/materials/{material_id}", response_model=schemas.TicketMaterialResponse)
def update_ticket_material(material_id: str, update: schemas.TicketMaterialUpdate, db: Session = Depends(get_db)):
    mat = db.query(models.TicketMaterial).filter(models.TicketMaterial.id == material_id).first()
    if not mat: raise HTTPException(status_code=404, detail="Material not found")
    if update.quantity is not None: mat.quantity = update.quantity
    if update.product_id: mat.product_id = update.product_id
    db.commit()
    db.refresh(mat)
    return mat

@router.delete("/{ticket_id}/materials/{material_id}")
def delete_ticket_material(ticket_id: int, material_id: str, db: Session = Depends(get_db)):
    mat = db.query(models.TicketMaterial).filter(models.TicketMaterial.id == material_id).first()
    if not mat: raise HTTPException(status_code=404, detail="Material not found")
    db.delete(mat)
    db.commit()
    return {"status": "deleted"}

@router.post("/{ticket_id}/articles/{article_id}")
def link_article_to_ticket(ticket_id: int, article_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not ticket or not article: raise HTTPException(status_code=404, detail="Not found")
    if article not in ticket.articles:
        ticket.articles.append(article)
        db.commit()
    return {"status": "linked"}

@router.delete("/{ticket_id}/articles/{article_id}")
def unlink_article_from_ticket(ticket_id: int, article_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not ticket or not article: raise HTTPException(status_code=404, detail="Not found")
    if article in ticket.articles:
        ticket.articles.remove(article)
        db.commit()
    return {"status": "unlinked"}

@router.post("/{ticket_id}/relations")
def link_ticket_relation(ticket_id: int, body: schemas.TicketRelationCreate, db: Session = Depends(get_db)):
    related_id = body.related_id
    relation_type = body.relation_type.value
    visibility = body.visibility.value
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    related = db.query(models.Ticket).filter(models.Ticket.id == related_id).first()
    if not ticket or not related:
        raise HTTPException(status_code=404, detail="Ticket not found")
    existing = db.execute(sa_text(
        "SELECT 1 FROM ticket_relations WHERE (ticket_id = :a AND related_id = :b) OR (ticket_id = :b AND related_id = :a)"
    ), {"a": ticket_id, "b": related_id}).first()
    if existing:
        return {"status": "already_exists"}
    db.execute(sa_text(
        "INSERT INTO ticket_relations (ticket_id, related_id, relation_type, visibility) VALUES (:a, :b, :rt, :v)"
    ), {"a": ticket_id, "b": related_id, "rt": relation_type, "v": visibility})
    db.commit()
    return {"status": "linked"}

@router.delete("/{ticket_id}/relations/{related_id}")
def unlink_ticket_relation(ticket_id: int, related_id: int, db: Session = Depends(get_db)):
    db.execute(sa_text(
        "DELETE FROM ticket_relations WHERE (ticket_id = :a AND related_id = :b) OR (ticket_id = :b AND related_id = :a)"
    ), {"a": ticket_id, "b": related_id})
    db.commit()
    return {"status": "unlinked"}

@router.post("/{ticket_id}/assets/{asset_id}")
def link_asset_to_ticket(ticket_id: int, asset_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not ticket or not asset: raise HTTPException(status_code=404, detail="Not found")
    if ticket.account_id != asset.account_id:
        raise HTTPException(status_code=400, detail="Asset belongs to different account")
    if asset not in ticket.assets:
        ticket.assets.append(asset)
        db.commit()
    return {"status": "linked"}

@router.delete("/{ticket_id}/assets/{asset_id}")
def unlink_asset_from_ticket(ticket_id: int, asset_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not ticket or not asset: raise HTTPException(status_code=404, detail="Not found")
    if asset in ticket.assets:
        ticket.assets.remove(asset)
        db.commit()
    return {"status": "unlinked"}
