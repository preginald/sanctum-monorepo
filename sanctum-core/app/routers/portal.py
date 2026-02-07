from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, asc
from uuid import UUID
from fastapi.responses import FileResponse
import os
from datetime import date

# STABLE IMPORTS
from .. import models, schemas, auth
from ..database import get_db
from ..models import ticket_contacts, Ticket, Invoice, InvoiceItem, Contact, Comment, Asset, Project, Milestone
from ..services.event_bus import event_bus

router = APIRouter(prefix="/portal", tags=["Portal"])

# --- HELPER ---
def get_current_contact(user: models.User, db: Session):
    if user.role != 'client' or not user.account_id:
        raise HTTPException(status_code=403, detail="Portal access only.")
    
    contact = db.query(Contact).filter(
        Contact.account_id == user.account_id,
        Contact.email == user.email
    ).first()

    if not contact:
        raise HTTPException(status_code=403, detail="No Contact profile found.")
    
    return contact

def verify_ticket_access(ticket_id: int, user: models.User, db: Session):
    """
    Ensures the user is a Contact on the ticket OR the ticket belongs to their account 
    (depending on strictness, usually M:N match is safer).
    """
    contact = get_current_contact(user, db)
    
    ticket = db.query(Ticket).options(joinedload(Ticket.account))\
        .outerjoin(ticket_contacts).filter(
        Ticket.id == ticket_id,
        Ticket.account_id == user.account_id,
        or_(
            Ticket.contact_id == contact.id,
            ticket_contacts.c.contact_id == contact.id
        )
    ).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found or access denied.")
    
    return ticket, contact

# --- DASHBOARD ---
@router.get("/dashboard", response_model=schemas.PortalDashboard)
def get_portal_dashboard(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role != 'client' or not current_user.account_id: 
        raise HTTPException(status_code=403, detail="Portal access only.")
    
    aid = current_user.account_id
    account = db.query(models.Account).filter(models.Account.id == aid).first()
    
    contact = db.query(Contact).filter(
        Contact.account_id == aid,
        Contact.email == current_user.email
    ).first()
    
    if contact:
        tickets = db.query(models.Ticket).outerjoin(ticket_contacts)\
            .options(joinedload(models.Ticket.time_entries), joinedload(models.Ticket.materials))\
            .filter(
                models.Ticket.account_id == aid, 
                models.Ticket.is_deleted == False,
                or_(
                    models.Ticket.contact_id == contact.id,
                    ticket_contacts.c.contact_id == contact.id
                )
            )\
            .distinct().order_by(desc(models.Ticket.created_at)).all()
    else:
        tickets = []

    invoices = db.query(models.Invoice).options(joinedload(models.Invoice.items))\
        .filter(models.Invoice.account_id == aid).order_by(desc(models.Invoice.generated_at)).all()
    
    projects = db.query(models.Project).options(joinedload(models.Project.milestones))\
        .filter(models.Project.account_id == aid, models.Project.is_deleted == False).all()
    
    # Get latest audit (draft or finalized) with actual submissions
    last_audit = db.query(models.AuditReport).filter(
    models.AuditReport.account_id == aid,
    models.AuditReport.template_id.isnot(None)  # Must have a template selected
    ).order_by(desc(models.AuditReport.created_at)).first();
    
    score = last_audit.security_score if last_audit else 0
    audit_id = str(last_audit.id) if last_audit else None
    
    return { 
    "account": account, 
    "security_score": score, 
    "audit_id": audit_id,  # ADD THIS LINE
    "open_tickets": tickets, 
    "invoices": invoices, 
    "projects": projects 
    }

# --- TICKET LIST ---
@router.get("/tickets")
def get_portal_tickets(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_active_user)
):
    contact = get_current_contact(current_user, db)
    
    tickets = db.query(Ticket).outerjoin(ticket_contacts).filter(
        Ticket.account_id == current_user.account_id,
        or_(
            Ticket.contact_id == contact.id, 
            ticket_contacts.c.contact_id == contact.id
        )
    ).distinct().order_by(desc(Ticket.created_at)).all()
    
    return [
        {
            "id": t.id,
            "subject": t.subject,
            "status": t.status,
            "created_at": t.created_at,
            "priority": t.priority,
            "updated_at": t.updated_at
        } for t in tickets
    ]

# --- TICKET DETAIL (ENRICHED) ---
@router.get("/tickets/{ticket_id}")
def get_portal_ticket(
    ticket_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_active_user)
):
    ticket, contact = verify_ticket_access(ticket_id, current_user, db)

    comments = db.query(Comment).options(joinedload(Comment.author))\
        .filter(
            Comment.ticket_id == ticket.id,
            Comment.visibility == 'public'
        ).order_by(asc(Comment.created_at)).all()

    formatted_comments = [{
        "id": c.id,
        "body": c.body,
        "created_at": c.created_at,
        "author_name": c.author.full_name if c.author else "Support",
        "is_me": c.author_id == current_user.id
    } for c in comments]

    formatted_assets = [{
        "id": a.id,
        "name": a.name,
        "type": a.asset_type,
        "status": a.status
    } for a in ticket.assets]

    return {
        "id": ticket.id,
        "subject": ticket.subject,
        "status": ticket.status,
        "priority": ticket.priority,
        "description": ticket.description,
        "created_at": ticket.created_at,
        "resolution": ticket.resolution,
        "milestone": ticket.milestone.name if ticket.milestone else None,
        "brand_affinity": ticket.account.brand_affinity if ticket.account else 'ds',
        "comments": formatted_comments,
        "assets": formatted_assets
    }

@router.post("/tickets/{ticket_id}/comments")
def create_portal_comment(
    ticket_id: int,
    payload: schemas.CommentCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    ticket, contact = verify_ticket_access(ticket_id, current_user, db)
    
    new_comment = Comment(
        ticket_id=ticket.id,
        author_id=current_user.id,
        body=payload.body,
        visibility='public' 
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    event_bus.emit("ticket_comment_created", ticket, background_tasks)
    
    return {
        "id": new_comment.id,
        "body": new_comment.body,
        "created_at": new_comment.created_at,
        "author_name": current_user.full_name,
        "is_me": True
    }

@router.get("/tickets/{ticket_id}/invoices")
def get_portal_ticket_invoices(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    ticket, _ = verify_ticket_access(ticket_id, current_user, db)

    invoices = db.query(Invoice).join(InvoiceItem).filter(
        InvoiceItem.ticket_id == ticket.id,
        Invoice.status != 'draft'
    ).distinct().all()

    return [
        {
            "id": str(inv.id),
            "total_amount": inv.total_amount,
            "status": inv.status,
            "due_date": inv.due_date,
            "generated_at": inv.generated_at,
            "pdf_generated": bool(inv.pdf_path)
        }
        for inv in invoices
    ]

# --- ASSETS ---
@router.get("/assets")
def get_portal_assets(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not current_user.account_id:
        raise HTTPException(status_code=403, detail="No account context.")

    assets = db.query(Asset).filter(
        Asset.account_id == current_user.account_id,
        Asset.status != 'retired'
    ).order_by(Asset.asset_type, Asset.name).all()

    return [
        {
            "id": a.id,
            "name": a.name,
            "asset_type": a.asset_type,
            "status": a.status,
            "serial_number": a.serial_number,
            "ip_address": a.ip_address,
            "expires_at": a.expires_at
        } for a in assets
    ]

# --- PROJECTS ---
@router.get("/projects/{project_id}")
def get_portal_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not current_user.account_id:
        raise HTTPException(status_code=403, detail="No account context.")

    project = db.query(Project).options(joinedload(Project.milestones)).filter(
        Project.id == project_id,
        Project.account_id == current_user.account_id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Calculate Progress
    total_milestones = len(project.milestones)
    completed_milestones = len([m for m in project.milestones if m.status == 'completed'])
    progress = (completed_milestones / total_milestones * 100) if total_milestones > 0 else 0

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "start_date": project.start_date,
        "due_date": project.due_date,
        "progress": round(progress),
        "milestones": [
            {
                "id": m.id,
                "name": m.name,
                "status": m.status,
                "due_date": m.due_date
            } for m in project.milestones
        ]
    }

# --- INVOICE DOWNLOAD ---
@router.get("/invoices/{invoice_id}/download")
def download_portal_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not current_user.account_id:
        raise HTTPException(status_code=403, detail="No account context.")

    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.account_id == current_user.account_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if not invoice.pdf_path:
        raise HTTPException(status_code=404, detail="Invoice PDF not generated.")

    base_path = os.getcwd()
    clean_path = invoice.pdf_path.lstrip('/')
    
    if os.path.isabs(invoice.pdf_path) and os.path.exists(invoice.pdf_path):
        return FileResponse(invoice.pdf_path, media_type='application/pdf', filename=f"Invoice_{invoice.id}.pdf")

    candidates = [
        os.path.join(base_path, "app", clean_path),      
        os.path.join(base_path, clean_path),             
        os.path.join(base_path, "app", "static", "reports", os.path.basename(clean_path)) 
    ]

    final_path = None
    for path in candidates:
        if os.path.exists(path):
            final_path = path
            break
    
    if not final_path:
        raise HTTPException(status_code=404, detail="Invoice PDF file missing on server.")

    return FileResponse(
        final_path,
        media_type='application/pdf',
        filename=f"Invoice_{invoice.id}.pdf"
    )