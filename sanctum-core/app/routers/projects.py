from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, text as sa_text
from typing import List, Optional
from datetime import datetime, timedelta, date
from .. import models, schemas, auth
from ..database import get_db
from ..services.pdf_engine import pdf_engine
from ..services.milestone_validation import validate_milestone_transition, get_available_transitions as get_milestone_transitions, validate_milestone_status
from ..services.project_validation import validate_project_transition, get_available_transitions as get_project_transitions
from ..services.cascade import cascade_from_milestone
from ..services.expand import ExpandConfig, get_expand_config, expanded_response
from decimal import Decimal, ROUND_HALF_UP
import os

router = APIRouter(tags=["Projects & Audits"])


def _validate_discount(market_value, quoted_price, discount_reason):
    """Validate discount register per BUS-001 D5/D7. Returns computed discount_amount or None."""
    if market_value is not None and quoted_price is not None:
        if quoted_price < market_value:
            discount_amount = market_value - quoted_price
            if not (discount_reason or '').strip():
                raise HTTPException(
                    status_code=422,
                    detail={
                        "detail": f"discount_reason_required: quoted_price is ${discount_amount:,.2f} below market_value — provide a discount_reason",
                        "error_code": "discount_reason_required",
                        "discount_amount": str(discount_amount),
                        "help": "Provide a discount_reason (e.g. 'launch support', 'gift'). See BUS-001 D5.",
                    },
                )
            return discount_amount
        else:
            return Decimal("0")
    return None


# --- PROJECTS ---
@router.get("/projects", response_model=List[schemas.ProjectResponse])
def get_projects(account_id: Optional[str] = None, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Project).join(models.Account).filter(models.Project.is_deleted == False)
    if current_user.role == 'client': query = query.filter(models.Project.account_id == current_user.account_id)
    if account_id: query = query.filter(models.Project.account_id == account_id)
    projects = query.all()
    for p in projects:
        p.account_name = p.account.name
        p.available_transitions = get_project_transitions(p.status, db)
    return projects

@router.get("/projects/{project_id}", response_model=schemas.ProjectResponse)
def get_project_detail(project_id: str, expand: ExpandConfig = Depends(get_expand_config), db: Session = Depends(get_db)):
    # Skip expensive milestone/ticket joinedload when not expanding
    if expand.should_expand("milestones"):
        project = db.query(models.Project).options(
            joinedload(models.Project.milestones).selectinload(models.Milestone.tickets),
            joinedload(models.Project.account),
        ).filter(models.Project.id == project_id).first()
    else:
        project = db.query(models.Project).options(
            joinedload(models.Project.account),
        ).filter(models.Project.id == project_id).first()

    if not project: raise HTTPException(status_code=404, detail="Project not found")
    project.account_name = project.account.name

    # Annotate tickets with time entry cost aggregates (only when milestones expanded)
    if expand.should_expand("milestones"):
        ticket_ids = [t.id for m in project.milestones for t in m.tickets]
        if ticket_ids:
            TE = models.TicketTimeEntry
            cost_data = db.query(
                TE.ticket_id,
                func.sum(func.extract('epoch', TE.end_time - TE.start_time) / 3600).label('hours'),
                func.sum(
                    func.coalesce(models.Product.unit_price, 0) *
                    func.extract('epoch', TE.end_time - TE.start_time) / 3600
                ).label('cost'),
                func.count(1).filter(TE.product_id.is_(None)).label('unpriced'),
            ).outerjoin(models.Product, TE.product_id == models.Product.id).filter(
                TE.ticket_id.in_(ticket_ids)
            ).group_by(TE.ticket_id).all()
            cost_map = {r.ticket_id: r for r in cost_data}
            for ms in project.milestones:
                for t in ms.tickets:
                    row = cost_map.get(t.id)
                    if row:
                        t.__dict__['total_hours'] = round(float(row.hours or 0), 2)
                        t.__dict__['total_cost'] = Decimal(str(round(float(row.cost or 0), 2)))
                        t.__dict__['unpriced_entries'] = int(row.unpriced or 0)

    # Attach linked artefacts (only when expanding)
    if expand.should_expand("artefacts"):
        artefact_ids = db.query(models.ArtefactLink.artefact_id).filter(
            models.ArtefactLink.linked_entity_type == "project",
            models.ArtefactLink.linked_entity_id == str(project_id),
        ).all()
        ids = [r[0] for r in artefact_ids]
        project.artefacts = db.query(models.Artefact).filter(
            models.Artefact.id.in_(ids), models.Artefact.is_deleted == False
        ).all() if ids else []

    project.available_transitions = get_project_transitions(project.status, db)

    # Compute counts before filtering (need full data for accurate counts)
    milestone_count = len(project.milestones) if hasattr(project, 'milestones') and project.milestones else (
        db.query(func.count(models.Milestone.id)).filter(models.Milestone.project_id == project_id).scalar()
    )
    artefact_count = len(project.artefacts) if hasattr(project, 'artefacts') and project.artefacts else (
        db.query(func.count(models.ArtefactLink.id)).filter(
            models.ArtefactLink.linked_entity_type == "project",
            models.ArtefactLink.linked_entity_id == str(project_id),
        ).scalar()
    )

    # Serialise, filter, and return
    response_data = jsonable_encoder(schemas.ProjectResponse.model_validate(project))
    response_data["milestone_count"] = milestone_count
    response_data["artefact_count"] = artefact_count
    return expanded_response(response_data, expand, "project")

@router.post("/projects", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    data = project.model_dump()
    discount_amount = _validate_discount(data.get('market_value'), data.get('quoted_price'), data.get('discount_reason'))
    if discount_amount is not None:
        data['discount_amount'] = discount_amount
        if discount_amount == 0:
            data['discount_reason'] = None
    new_project = models.Project(**data)
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    new_project.account = db.query(models.Account).filter(models.Account.id == project.account_id).first()
    new_project.account_name = new_project.account.name
    new_project.available_transitions = get_project_transitions(new_project.status, db)
    return new_project

@router.put("/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: str, update: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj: raise HTTPException(status_code=404, detail="Project not found")
    update_data = update.model_dump(exclude_unset=True)
    # Project status transition validation
    if 'status' in update_data and update_data['status'] != proj.status and not update.skip_validation:
        validate_project_transition(proj.status, update_data['status'], proj, db)
    # Merge existing values with update for discount validation
    effective_mv = update_data.get('market_value', proj.market_value)
    effective_qp = update_data.get('quoted_price', proj.quoted_price)
    effective_dr = update_data.get('discount_reason', proj.discount_reason)
    discount_amount = _validate_discount(effective_mv, effective_qp, effective_dr)
    if discount_amount is not None:
        update_data['discount_amount'] = discount_amount
        if discount_amount == 0:
            update_data['discount_reason'] = None
    for field, value in update_data.items():
        setattr(proj, field, value)
    db.commit()
    db.refresh(proj)
    proj.account_name = proj.account.name
    proj.available_transitions = get_project_transitions(proj.status, db)
    return proj

@router.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj: raise HTTPException(status_code=404, detail="Project not found")
    proj.is_deleted = True
    db.commit()
    return {"status": "archived"}

@router.get("/projects/{project_id}/milestones", response_model=List[schemas.MilestoneResponse])
def list_milestones(project_id: str, db: Session = Depends(get_db)):
    milestones = db.query(models.Milestone).filter(
        models.Milestone.project_id == project_id
    ).order_by(models.Milestone.sequence.asc()).all()
    for ms in milestones:
        ms.available_transitions = get_milestone_transitions(ms.status, db)
    return milestones

@router.post("/projects/{project_id}/milestones", response_model=schemas.MilestoneResponse)
def create_milestone(project_id: str, milestone: schemas.MilestoneCreate, db: Session = Depends(get_db)):
    validate_milestone_status(milestone.status, db)
    new_milestone = models.Milestone(**milestone.model_dump(), project_id=project_id)
    db.add(new_milestone)
    db.flush()
    cascade_from_milestone(new_milestone, db)
    db.commit()
    db.refresh(new_milestone)
    return new_milestone

@router.put("/milestones/{milestone_id}", response_model=schemas.MilestoneResponse)
def update_milestone(milestone_id: str, update: schemas.MilestoneUpdate, db: Session = Depends(get_db)):
    ms = db.query(models.Milestone).filter(models.Milestone.id == milestone_id).first()
    if not ms: raise HTTPException(status_code=404, detail="Milestone not found")

    # Status transition validation (before applying changes)
    if update.status and update.status != ms.status and not update.skip_validation:
        # If description is being set in the same request, apply it first for the condition check
        if update.description is not None:
            ms.description = update.description
        validate_milestone_transition(ms.status, update.status, ms, db)

    old_ms_status = ms.status
    if update.status: ms.status = update.status
    if update.name: ms.name = update.name
    if update.billable_amount is not None: ms.billable_amount = update.billable_amount
    if update.due_date: ms.due_date = update.due_date
    if update.sequence is not None: ms.sequence = update.sequence
    if update.description is not None: ms.description = update.description
    if update.invoice_id is not None: ms.invoice_id = update.invoice_id
    # Cascade milestone status change to project
    if ms.status != old_ms_status:
        cascade_from_milestone(ms, db)
    db.commit()
    db.refresh(ms)
    ms.project_name = ms.project.name if ms.project else None
    ms.available_transitions = get_milestone_transitions(ms.status, db)
    return ms

@router.get("/milestones/{milestone_id}", response_model=schemas.MilestoneResponse)
def get_milestone_detail(milestone_id: str, expand: ExpandConfig = Depends(get_expand_config), db: Session = Depends(get_db)):
    ms = db.query(models.Milestone).options(
        joinedload(models.Milestone.tickets),
        joinedload(models.Milestone.project).joinedload(models.Project.account)
    ).filter(models.Milestone.id == milestone_id).first()
    if not ms: raise HTTPException(status_code=404, detail="Milestone not found")
    ms.project_name = ms.project.name if ms.project else None
    ms.account_id = ms.project.account_id if ms.project else None
    ms.account_name = ms.project.account.name if ms.project and ms.project.account else None

    # Build related_tickets for each ticket in this milestone
    ticket_ids = [t.id for t in ms.tickets]
    rel_map = {}
    if ticket_ids:
        relations_raw = db.execute(sa_text("""
            SELECT t.id, t.subject, t.status, t.priority, t.ticket_type,
                   tr.relation_type, tr.visibility,
                   tr.ticket_id as source_id, tr.related_id
            FROM ticket_relations tr
            JOIN tickets t ON t.id = CASE
                WHEN tr.ticket_id = ANY(:tids) THEN tr.related_id
                ELSE tr.ticket_id END
            WHERE tr.ticket_id = ANY(:tids) OR tr.related_id = ANY(:tids)
        """), {"tids": ticket_ids}).fetchall()

        from collections import defaultdict
        rel_map = defaultdict(list)
        for row in relations_raw:
            for tid in ticket_ids:
                if row.source_id == tid or row.related_id == tid:
                    relation_type = row.relation_type
                    if row.relation_type == "blocks" and row.source_id != tid:
                        relation_type = "blocked_by"
                    elif row.relation_type == "duplicates" and row.source_id != tid:
                        relation_type = "duplicate_of"
                    if row.id != tid:
                        rel_map[tid].append(schemas.TicketRelationResponse(
                            id=row.id, subject=row.subject, status=row.status,
                            priority=row.priority, ticket_type=row.ticket_type,
                            relation_type=relation_type, visibility=row.visibility
                        ))

    # Check which tickets have linked articles
    article_tids = set()
    if ticket_ids:
        article_rows = db.execute(sa_text(
            "SELECT DISTINCT ticket_id FROM ticket_articles WHERE ticket_id = ANY(:tids)"
        ), {"tids": ticket_ids}).fetchall()
        article_tids = {row.ticket_id for row in article_rows}

    ticket_briefs = []
    for ticket in ms.tickets:
        tb = schemas.TicketBrief(
            id=ticket.id,
            subject=ticket.subject,
            status=ticket.status,
            priority=ticket.priority,
            ticket_type=ticket.ticket_type,
            milestone_id=ticket.milestone_id,
            created_at=ticket.created_at,
            description=ticket.description,
            has_articles=ticket.id in article_tids,
            related_tickets=rel_map.get(ticket.id, [])
        )
        ticket_briefs.append(tb)

    # Attach linked artefacts
    artefact_ids = db.query(models.ArtefactLink.artefact_id).filter(
        models.ArtefactLink.linked_entity_type == "milestone",
        models.ArtefactLink.linked_entity_id == str(milestone_id),
    ).all()
    art_ids = [r[0] for r in artefact_ids]
    artefact_list = db.query(models.Artefact).filter(
        models.Artefact.id.in_(art_ids), models.Artefact.is_deleted == False
    ).all() if art_ids else []

    ms_response = schemas.MilestoneResponse(
        id=ms.id,
        name=ms.name,
        due_date=ms.due_date,
        status=ms.status,
        billable_amount=ms.billable_amount,
        sequence=ms.sequence,
        description=ms.description,
        project_id=ms.project_id,
        invoice_id=ms.invoice_id,
        created_at=ms.created_at,
        project_name=ms.project.name if ms.project else None,
        account_id=ms.project.account_id if ms.project else None,
        account_name=ms.project.account.name if ms.project and ms.project.account else None,
        tickets=ticket_briefs,
        artefacts=artefact_list,
        ticket_count=len(ticket_briefs),
        available_transitions=get_milestone_transitions(ms.status, db),
    )

    response_data = jsonable_encoder(ms_response)
    return expanded_response(response_data, expand, "milestone")

@router.get("/projects/{project_id}/artefacts", response_model=List[schemas.ArtefactLite])
def project_artefacts(project_id: str, db: Session = Depends(get_db)):
    artefact_ids = db.query(models.ArtefactLink.artefact_id).filter(
        models.ArtefactLink.linked_entity_type == "project",
        models.ArtefactLink.linked_entity_id == project_id,
    ).all()
    ids = [r[0] for r in artefact_ids]
    if not ids:
        return []
    return db.query(models.Artefact).filter(
        models.Artefact.id.in_(ids),
        models.Artefact.is_deleted == False,
    ).all()

@router.get("/milestones/{milestone_id}/artefacts", response_model=List[schemas.ArtefactLite])
def milestone_artefacts(milestone_id: str, db: Session = Depends(get_db)):
    artefact_ids = db.query(models.ArtefactLink.artefact_id).filter(
        models.ArtefactLink.linked_entity_type == "milestone",
        models.ArtefactLink.linked_entity_id == milestone_id,
    ).all()
    ids = [r[0] for r in artefact_ids]
    if not ids:
        return []
    return db.query(models.Artefact).filter(
        models.Artefact.id.in_(ids),
        models.Artefact.is_deleted == False,
    ).all()

@router.post("/projects/{project_id}/milestones/reorder")
def reorder_milestones(project_id: str, payload: schemas.MilestoneReorderRequest, db: Session = Depends(get_db)):
    for item in payload.items:
        ms = db.query(models.Milestone).filter(models.Milestone.id == item.id, models.Milestone.project_id == project_id).first()
        if ms: ms.sequence = item.sequence
    db.commit()
    return {"status": "updated"}

@router.post("/milestones/{milestone_id}/invoice", response_model=schemas.InvoiceResponse)
def generate_milestone_invoice(milestone_id: str, db: Session = Depends(get_db)):
    ms = db.query(models.Milestone).join(models.Project).filter(models.Milestone.id == milestone_id).first()
    if not ms: raise HTTPException(status_code=404, detail="Milestone not found")
    if ms.billable_amount <= 0: raise HTTPException(status_code=400, detail="Nothing to bill")
    if ms.invoice_id: raise HTTPException(status_code=400, detail="Already invoiced")

    # FIX: Use Decimal Math
    subtotal = ms.billable_amount
    gst = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total = subtotal + gst

    new_invoice = models.Invoice(
        account_id=ms.project.account_id, status="draft", subtotal_amount=subtotal, gst_amount=gst, total_amount=total,
        due_date=datetime.now() + timedelta(days=14), generated_at=func.now()
    )
    db.add(new_invoice)
    db.flush()

    line_item = models.InvoiceItem(
        invoice_id=new_invoice.id, description=f"Project Milestone: {ms.project.name} - {ms.name}",
        quantity=Decimal("1.00"), unit_price=subtotal, total=subtotal
    )
    db.add(line_item)
    ms.invoice_id = new_invoice.id
    ms.status = 'completed'
    cascade_from_milestone(ms, db)
    db.commit()
    db.refresh(new_invoice)
    return new_invoice

# --- AUDITS ---
@router.get("/audits", response_model=List[schemas.AuditResponse])
def get_audits(account_id: Optional[str] = None, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.AuditReport, models.AuditTemplate.name.label("template_name")).outerjoin(
        models.AuditTemplate, models.AuditReport.template_id == models.AuditTemplate.id
    )
    if current_user.role == 'client': query = query.filter(models.AuditReport.account_id == current_user.account_id)
    elif current_user.access_scope == 'nt_only': query = query.join(models.Account, models.AuditReport.account_id == models.Account.id).filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only': query = query.join(models.Account, models.AuditReport.account_id == models.Account.id).filter(models.Account.brand_affinity.in_(['ds', 'both']))
    if account_id: query = query.filter(models.AuditReport.account_id == account_id)
    results = query.all()
    enriched = []
    for row in results:
        audit = row[0] if isinstance(row, tuple) else row.AuditReport
        tpl_name = row[1] if isinstance(row, tuple) else row.template_name
        resp = schemas.AuditResponse.model_validate(audit)
        resp.template_name = tpl_name
        enriched.append(resp)
    return enriched

@router.get("/audits/{audit_id}", response_model=schemas.AuditResponse)
def get_audit_detail(audit_id: str, db: Session = Depends(get_db)):
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit: raise HTTPException(status_code=404, detail="Audit not found")
    return audit

@router.post("/audits", response_model=schemas.AuditResponse)
def create_audit_draft(audit: schemas.AuditCreate, db: Session = Depends(get_db)):
    content_payload = {"items": [item.model_dump() for item in audit.items]}
    new_audit = models.AuditReport(
        account_id=audit.account_id,
        deal_id=audit.deal_id,
        template_id=audit.template_id,
        content=content_payload,
        status="draft",
    )
    db.add(new_audit)
    db.commit()
    db.refresh(new_audit)
    return new_audit

@router.put("/audits/{audit_id}", response_model=schemas.AuditResponse)
def update_audit_content(audit_id: str, audit_update: schemas.AuditUpdate, db: Session = Depends(get_db)):
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit: raise HTTPException(status_code=404, detail="Audit not found")
    content_payload = {"items": [item.model_dump() for item in audit_update.items]}
    audit.content = content_payload
    total_score = 0
    items = audit_update.items
    if items:
        for item in items:
            s = item.status.lower()
            if s == 'green': total_score += 100
            elif s == 'amber': total_score += 50
        final_score = int(total_score / len(items))
    else: final_score = 0
    audit.security_score = final_score
    audit.infrastructure_score = final_score
    audit.updated_at = func.now()
    db.commit()
    db.refresh(audit)
    return audit

@router.post("/audits/{audit_id}/finalize", response_model=schemas.AuditResponse)
def finalize_audit(audit_id: str, db: Session = Depends(get_db)):
    audit_record = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit_record: raise HTTPException(status_code=404, detail="Audit not found")
    account = db.query(models.Account).filter(models.Account.id == audit_record.account_id).first()
    items = audit_record.content.get('items', [])
    if not items: raise HTTPException(status_code=400, detail="Cannot finalize empty audit")
    total_score = 0
    for item in items:
        s = item.get('status', 'green')
        if s == 'green': total_score += 100
        elif s == 'amber': total_score += 50
    final_score = int(total_score / len(items))
    pdf_data = { "client_name": account.name, "security_score": final_score, "infrastructure_score": final_score, "content": audit_record.content }
    filename = f"audit_{audit_id}.pdf"

    # Safe path handling
    cwd = os.getcwd()
    static_dir = os.path.join(cwd, "app/static/reports")
    if not os.path.exists(static_dir): os.makedirs(static_dir)
    abs_path = os.path.join(static_dir, filename)

    pdf = pdf_engine.generate_audit_pdf(pdf_data)
    pdf.output(abs_path)
    audit_record.security_score = final_score
    audit_record.infrastructure_score = final_score
    audit_record.status = "finalized"
    audit_record.report_pdf_path = f"/static/reports/{filename}"
    audit_record.finalized_at = func.now()
    db.commit()
    db.refresh(audit_record)
    return audit_record


# --- RATE CARDS ---
@router.get("/rate-cards", response_model=List[schemas.RateCardResponse])
def list_rate_cards(account_id: Optional[str] = None, tier: Optional[str] = None, system: Optional[bool] = None, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.RateCard)
    if system:
        query = query.filter(models.RateCard.account_id == None)
    elif account_id:
        query = query.filter(models.RateCard.account_id == account_id)
    if tier:
        query = query.filter(models.RateCard.tier == tier)
    cards = query.order_by(models.RateCard.tier, models.RateCard.effective_from.desc()).all()
    for c in cards:
        c.account_name = c.account.name if c.account else None
    return cards


@router.get("/rate-cards/lookup", response_model=schemas.RateCardResponse)
def lookup_rate(account_id: str, tier: str, as_of: Optional[date] = None, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    target_date = as_of or date.today()
    # Try account override first
    card = db.query(models.RateCard).filter(
        models.RateCard.account_id == account_id,
        models.RateCard.tier == tier,
        models.RateCard.effective_from <= target_date,
    ).order_by(models.RateCard.effective_from.desc()).first()
    # Fall back to system default
    if not card:
        card = db.query(models.RateCard).filter(
            models.RateCard.account_id == None,
            models.RateCard.tier == tier,
            models.RateCard.effective_from <= target_date,
        ).order_by(models.RateCard.effective_from.desc()).first()
    if not card:
        raise HTTPException(status_code=404, detail=f"No rate card found for tier '{tier}'")
    card.account_name = card.account.name if card.account else None
    return card


@router.post("/rate-cards", response_model=schemas.RateCardResponse)
def create_rate_card(card: schemas.RateCardCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    new_card = models.RateCard(**card.model_dump())
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    new_card.account_name = new_card.account.name if new_card.account else None
    return new_card


@router.put("/rate-cards/{card_id}", response_model=schemas.RateCardResponse)
def update_rate_card(card_id: str, update: schemas.RateCardUpdate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    card = db.query(models.RateCard).filter(models.RateCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Rate card not found")
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(card, field, value)
    db.commit()
    db.refresh(card)
    card.account_name = card.account.name if card.account else None
    return card
