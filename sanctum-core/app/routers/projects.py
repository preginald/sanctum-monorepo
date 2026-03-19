from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, text as sa_text
from typing import List, Optional
from datetime import datetime, timedelta
from .. import models, schemas, auth
from ..database import get_db
from ..services.pdf_engine import pdf_engine
from decimal import Decimal, ROUND_HALF_UP
import os

router = APIRouter(tags=["Projects & Audits"])

# --- PROJECTS ---
@router.get("/projects", response_model=List[schemas.ProjectResponse])
def get_projects(account_id: Optional[str] = None, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Project).join(models.Account).filter(models.Project.is_deleted == False)
    if current_user.role == 'client': query = query.filter(models.Project.account_id == current_user.account_id)
    if account_id: query = query.filter(models.Project.account_id == account_id)
    projects = query.all()
    for p in projects: p.account_name = p.account.name
    return projects

@router.get("/projects/{project_id}", response_model=schemas.ProjectResponse)
def get_project_detail(project_id: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).options(joinedload(models.Project.milestones).selectinload(models.Milestone.tickets), joinedload(models.Project.account)).filter(models.Project.id == project_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    project.account_name = project.account.name
    return project

@router.post("/projects", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    new_project = models.Project(**project.model_dump())
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    new_project.account = db.query(models.Account).filter(models.Account.id == project.account_id).first()
    new_project.account_name = new_project.account.name
    return new_project

@router.put("/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: str, update: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj: raise HTTPException(status_code=404, detail="Project not found")
    if update.status: proj.status = update.status
    if update.name: proj.name = update.name
    if update.budget is not None: proj.budget = update.budget
    if update.due_date: proj.due_date = update.due_date
    db.commit()
    db.refresh(proj)
    proj.account_name = proj.account.name
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
    return milestones

@router.post("/projects/{project_id}/milestones", response_model=schemas.MilestoneResponse)
def create_milestone(project_id: str, milestone: schemas.MilestoneCreate, db: Session = Depends(get_db)):
    new_milestone = models.Milestone(**milestone.model_dump(), project_id=project_id)
    db.add(new_milestone)
    db.commit()
    db.refresh(new_milestone)
    return new_milestone

@router.put("/milestones/{milestone_id}", response_model=schemas.MilestoneResponse)
def update_milestone(milestone_id: str, update: schemas.MilestoneUpdate, db: Session = Depends(get_db)):
    ms = db.query(models.Milestone).filter(models.Milestone.id == milestone_id).first()
    if not ms: raise HTTPException(status_code=404, detail="Milestone not found")
    if update.status: ms.status = update.status
    if update.name: ms.name = update.name
    if update.billable_amount is not None: ms.billable_amount = update.billable_amount
    if update.due_date: ms.due_date = update.due_date
    if update.sequence is not None: ms.sequence = update.sequence
    if update.description is not None: ms.description = update.description
    db.commit()
    db.refresh(ms)
    ms.project_name = ms.project.name if ms.project else None
    return ms

@router.get("/milestones/{milestone_id}", response_model=schemas.MilestoneResponse)
def get_milestone_detail(milestone_id: str, db: Session = Depends(get_db)):
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

        # Group relations by ticket
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
                    # Don't add self-references
                    if row.id != tid:
                        rel_map[tid].append(schemas.TicketRelationResponse(
                            id=row.id, subject=row.subject, status=row.status,
                            priority=row.priority, ticket_type=row.ticket_type,
                            relation_type=relation_type, visibility=row.visibility
                        ))

    # Build ticket briefs manually to avoid ORM related_tickets serialisation
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
            related_tickets=rel_map.get(ticket.id, [])
        )
        ticket_briefs.append(tb)

    return schemas.MilestoneResponse(
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
    )

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
    db.commit()
    db.refresh(new_invoice)
    return new_invoice

# --- AUDITS ---
@router.get("/audits", response_model=List[schemas.AuditResponse])
def get_audits(account_id: Optional[str] = None, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.AuditReport)
    if current_user.role == 'client': query = query.filter(models.AuditReport.account_id == current_user.account_id)
    elif current_user.access_scope == 'nt_only': query = query.join(models.Account).filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only': query = query.join(models.Account).filter(models.Account.brand_affinity.in_(['ds', 'both']))
    if account_id: query = query.filter(models.AuditReport.account_id == account_id)
    return query.all()

@router.get("/audits/{audit_id}", response_model=schemas.AuditResponse)
def get_audit_detail(audit_id: str, db: Session = Depends(get_db)):
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit: raise HTTPException(status_code=404, detail="Audit not found")
    return audit

@router.post("/audits", response_model=schemas.AuditResponse)
def create_audit_draft(audit: schemas.AuditCreate, db: Session = Depends(get_db)):
    content_payload = {"items": [item.model_dump() for item in audit.items]}
    new_audit = models.AuditReport(account_id=audit.account_id, deal_id=audit.deal_id, content=content_payload, status="draft")
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
