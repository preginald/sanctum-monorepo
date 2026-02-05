from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_
from uuid import UUID
from fastapi.responses import FileResponse
import os

# STABLE IMPORTS
from .. import models, schemas, auth
from ..database import get_db
from ..models import ticket_contacts, Ticket, Invoice, InvoiceItem, Contact

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

# --- DASHBOARD (UNCHANGED) ---
@router.get("/dashboard", response_model=schemas.PortalDashboard)
def get_portal_dashboard(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role != 'client' or not current_user.account_id: 
        raise HTTPException(status_code=403, detail="Portal access only.")
    
    aid = current_user.account_id
    account = db.query(models.Account).filter(models.Account.id == aid).first()
    
    # Resolve Contact ID
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
    
    last_audit = db.query(models.AuditReport).filter(models.AuditReport.account_id == aid, models.AuditReport.status == 'finalized')\
        .order_by(desc(models.AuditReport.finalized_at)).first()
    
    score = last_audit.security_score if last_audit else 0
    
    return { "account": account, "security_score": score, "open_tickets": tickets, "invoices": invoices, "projects": projects }

# --- TICKET LIST (STRICT SCOPE) ---
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

# --- TICKET DETAIL (UPDATED FOR BRANDING) ---
@router.get("/tickets/{ticket_id}")
def get_portal_ticket(
    ticket_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_active_user)
):
    contact = get_current_contact(current_user, db)

    # Join Account to get brand_affinity
    ticket = db.query(Ticket).options(joinedload(Ticket.account))\
        .outerjoin(ticket_contacts).filter(
        Ticket.id == ticket_id,
        Ticket.account_id == current_user.account_id,
        or_(
            Ticket.contact_id == contact.id,
            ticket_contacts.c.contact_id == contact.id
        )
    ).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found or access denied.")

    return {
        "id": ticket.id,
        "subject": ticket.subject,
        "status": ticket.status,
        "description": ticket.description,
        "created_at": ticket.created_at,
        "resolution": ticket.resolution,
        "milestone": ticket.milestone.name if ticket.milestone else None,
        "brand_affinity": ticket.account.brand_affinity if ticket.account else 'ds' # <--- ADDED
    }

@router.get("/tickets/{ticket_id}/invoices")
def get_portal_ticket_invoices(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    contact = get_current_contact(current_user, db)
    ticket = db.query(Ticket).outerjoin(ticket_contacts).filter(
        Ticket.id == ticket_id,
        Ticket.account_id == current_user.account_id,
        or_(
            Ticket.contact_id == contact.id,
            ticket_contacts.c.contact_id == contact.id
        )
    ).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found or access denied.")

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

# --- INVOICE DOWNLOAD (FIXED PATH LOGIC) ---
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

    # --- ROBUST PATH RESOLUTION ---
    base_path = os.getcwd()
    clean_path = invoice.pdf_path.lstrip('/')
    
    # Check 1: Is it absolute?
    if os.path.isabs(invoice.pdf_path) and os.path.exists(invoice.pdf_path):
        return FileResponse(invoice.pdf_path, media_type='application/pdf', filename=f"Invoice_{invoice.id}.pdf")

    # Define candidate paths to check in order
    candidates = [
        os.path.join(base_path, "app", clean_path),      # sanctum-core/app/static/reports/...
        os.path.join(base_path, clean_path),             # sanctum-core/static/reports/...
        os.path.join(base_path, "app", "static", "reports", os.path.basename(clean_path)) # Hardcoded fallback
    ]

    final_path = None
    for path in candidates:
        if os.path.exists(path):
            final_path = path
            break
    
    if not final_path:
        # Debug info for the server logs
        print(f"[ERROR] PDF Download Failed. DB Path: {invoice.pdf_path}")
        print(f"[DEBUG] Checked locations: {candidates}")
        raise HTTPException(status_code=404, detail="Invoice PDF file missing on server.")

    return FileResponse(
        final_path,
        media_type='application/pdf',
        filename=f"Invoice_{invoice.id}.pdf"
    )