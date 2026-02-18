from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, asc
from uuid import UUID
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
from datetime import date, datetime

# STABLE IMPORTS
from .. import models, schemas, auth
from ..database import get_db
from ..models import ticket_contacts, Ticket, Invoice, InvoiceItem, Contact, Comment, Asset, Project, Milestone
from ..services.event_bus import event_bus
from ..services.account_service import account_needs_questionnaire, get_account_lifecycle_stage, process_questionnaire_submission

router = APIRouter(prefix="/portal", tags=["Portal"])

# --- HELPER ---
def resolve_portal_account_id(user: models.User, impersonate: UUID = None) -> UUID:
    """
    Returns the account_id to use for portal queries.
    - Admin + impersonate param → use impersonated account
    - Client → use their own account_id
    - Otherwise → 403
    """
    if user.role == 'admin' and impersonate:
        return impersonate
    if user.role == 'client' and user.account_id:
        return user.account_id
    raise HTTPException(status_code=403, detail="Portal access only.")

def is_impersonating(user: models.User, impersonate: UUID = None) -> bool:
    return user.role == 'admin' and impersonate is not None

def get_current_contact(user: models.User, db: Session, account_id: UUID = None):
    """Get contact for the current user. Returns None for admin impersonation."""
    aid = account_id or user.account_id
    if user.role != 'client':
        return None  # Admin impersonating — no contact match needed
    
    if not aid:
        raise HTTPException(status_code=403, detail="Portal access only.")
    
    contact = db.query(Contact).filter(
        Contact.account_id == aid,
        Contact.email == user.email
    ).first()

    if not contact:
        raise HTTPException(status_code=403, detail="No Contact profile found.")
    
    return contact


def verify_ticket_access(ticket_id: int, user: models.User, db: Session, impersonate: UUID = None):
    """
    Ensures the user is a Contact on the ticket OR the ticket belongs to their account.
    Admins with impersonate bypass contact check.
    """
    # Admin impersonating — just verify ticket belongs to impersonated account
    if user.role == 'admin' and impersonate:
        ticket = db.query(Ticket).options(joinedload(Ticket.account))\
            .filter(Ticket.id == ticket_id, Ticket.account_id == impersonate).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found or access denied.")
        return ticket, None

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
def get_portal_dashboard(
    impersonate: UUID = None,
    current_user: models.User = Depends(auth.get_current_active_user), 
    db: Session = Depends(get_db)
):
    aid = resolve_portal_account_id(current_user, impersonate)
    account = db.query(models.Account).filter(models.Account.id == aid).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found.")
    
    contact = get_current_contact(current_user, db, aid)
    
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
        # Admin impersonating — show ALL account tickets
        tickets = db.query(models.Ticket)\
            .options(joinedload(models.Ticket.time_entries), joinedload(models.Ticket.materials))\
            .filter(
                models.Ticket.account_id == aid,
                models.Ticket.is_deleted == False
            ).order_by(desc(models.Ticket.created_at)).all()

    invoices = db.query(models.Invoice).options(joinedload(models.Invoice.items))\
        .filter(models.Invoice.account_id == aid).order_by(desc(models.Invoice.generated_at)).all()
    
    projects = db.query(models.Project).options(joinedload(models.Project.milestones))\
        .filter(models.Project.account_id == aid, models.Project.is_deleted == False).all()
    
    # PHASE 60A: Get all audits grouped by category
    audits = db.query(models.AuditReport)\
        .options(joinedload(models.AuditReport.template))\
        .filter(
            models.AuditReport.account_id == aid,
            models.AuditReport.template_id.isnot(None)
        ).order_by(desc(models.AuditReport.created_at)).all()
    
    # Build category assessments map (all assessments per category, not just latest)
    category_assessments = {}  # {security: [{id, template_name, status, score, created_at}, ...]}
    
    # Status priority for sorting (finalized > in_progress > draft)
    status_priority = {'finalized': 3, 'in_progress': 2, 'draft': 1}
    
    for audit in audits:
        if audit.template and audit.template.category:
            cat = audit.template.category
            
            # Determine score based on category
            if cat == 'security':
                score = audit.security_score or 0
            elif cat == 'infrastructure':
                score = audit.infrastructure_score or 0
            else:
                score = audit.security_score or 0
            
            assessment_data = {
                'id': str(audit.id),
                'template_name': audit.template.name,
                'framework': audit.template.framework,  # NEW: Include framework for matching
                'status': audit.status or 'draft',
                'score': score,
                'created_at': audit.created_at.isoformat() if audit.created_at else None
            }
            
            if cat not in category_assessments:
                category_assessments[cat] = []
            
            category_assessments[cat].append(assessment_data)
    
    # Sort each category's assessments by status priority (finalized first, then in_progress, then draft)
    for cat in category_assessments:
        category_assessments[cat].sort(
            key=lambda x: (status_priority.get(x['status'], 0), x['score']),
            reverse=True
        )
    
    # Legacy fields: Use primary (first) assessment from security category
    security_assessments = category_assessments.get('security', [])
    security_score = security_assessments[0]['score'] if security_assessments else 0
    security_audit_id = security_assessments[0]['id'] if security_assessments else None
    
    # PHASE 61A: Account lifecycle detection
    needs_questionnaire = account_needs_questionnaire(account, db)
    lifecycle_stage = get_account_lifecycle_stage(account, db)
    
    return { 
        "account": account, 
        "security_score": security_score,  # Legacy field
        "audit_id": security_audit_id,  # Legacy field
        "category_assessments": category_assessments,  # Phase 60A
        "needs_questionnaire": needs_questionnaire,  # Phase 61A
        "lifecycle_stage": lifecycle_stage,  # Phase 61A
        "open_tickets": tickets, 
        "invoices": invoices, 
        "projects": projects 
    }

# --- PHASE 61A: QUESTIONNAIRE ENDPOINTS ---

@router.get("/questionnaire")
def get_questionnaire_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get questionnaire status and existing responses if completed"""
    if current_user.role != 'client' or not current_user.account_id:
        raise HTTPException(status_code=403, detail="Portal access only.")
    
    account = db.query(models.Account).filter(
        models.Account.id == current_user.account_id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    needs_questionnaire = account_needs_questionnaire(account, db)
    lifecycle_stage = get_account_lifecycle_stage(account, db)
    
    scoping_responses = None
    if account.audit_data and account.audit_data.get('scoping_responses'):
        scoping_responses = account.audit_data.get('scoping_responses')
    
    return {
        "needs_questionnaire": needs_questionnaire,
        "lifecycle_stage": lifecycle_stage,
        "scoping_responses": scoping_responses
    }

@router.post("/questionnaire/submit")
def submit_questionnaire(
    payload: schemas.QuestionnaireSubmit,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Submit Pre-Engagement Questionnaire.
    Stores responses, creates draft assets, and generates internal review ticket.
    """
    if current_user.role != 'client' or not current_user.account_id:
        raise HTTPException(status_code=403, detail="Portal access only.")
    
    account = db.query(models.Account).filter(
        models.Account.id == current_user.account_id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # REFACTORED: Use centralized service
    result = process_questionnaire_submission(
        db=db,
        account=account,
        payload=payload,
        submitted_by_user_id=current_user.id,
        create_tickets=True
    )
    
    # Fire event for notifications
    if result.get('ticket'):
        event_bus.emit("questionnaire_completed", result['ticket'], background_tasks)
    
    return {
        "status": "success",
        "message": "Questionnaire submitted successfully",
        "ticket_id": result['ticket'].id if result.get('ticket') else None,
        "follow_up_tasks_created": 3,
        "draft_assets_created": result['draft_assets_count'],
        "lifecycle_stage": "onboarding"
    }

# --- ASSESSMENT REQUEST (PHASE 60A.2) ---
class AssessmentRequest(BaseModel):
    template_id: UUID

@router.post("/assessments/request")
def request_assessment(
    payload: AssessmentRequest,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Client requests an assessment. Creates:
    1. Draft audit report (status='draft')
    2. Support ticket (type='assessment') 
    """
    if current_user.role != 'client' or not current_user.account_id:
        raise HTTPException(status_code=403, detail="Portal access only.")
    
    # Get template details
    template = db.query(models.AuditTemplate).filter(
        models.AuditTemplate.id == payload.template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found.")
    
    # Get contact
    contact = db.query(Contact).filter(
        Contact.account_id == current_user.account_id,
        Contact.email == current_user.email
    ).first()
    
    # Create draft audit
    new_audit = models.AuditReport(
        account_id=current_user.account_id,
        template_id=template.id,
        status='draft',  # Client requested, not started
        security_score=0
    )
    db.add(new_audit)
    db.flush()  # Get audit ID
    
    # Create tracking ticket
    ticket_subject = f"Assessment Request: {template.name}"
    ticket_description = f"""Client has requested a {template.name} assessment.

Category: {template.category}
Framework: {template.framework}

Next Steps:
1. Schedule initial consultation within 1-2 business days
2. Complete assessment within timeline
3. Deliver report and recommendations

Audit ID: {new_audit.id}
"""
    
    new_ticket = Ticket(
        account_id=current_user.account_id,
        contact_id=contact.id if contact else None,
        subject=ticket_subject,
        description=ticket_description,
        ticket_type='assessment',
        priority='normal',
        status='new'
    )
    db.add(new_ticket)
    db.flush()
    
    # Link ticket to contacts (M:N)
    if contact:
        db.execute(
            ticket_contacts.insert().values(
                ticket_id=new_ticket.id,
                contact_id=contact.id
            )
        )
    
    db.commit()
    db.refresh(new_audit)
    db.refresh(new_ticket)
    
    # Fire event for notifications/emails
    event_bus.emit("ticket_created", new_ticket, background_tasks)
    
    return {
        "success": True,
        "audit_id": str(new_audit.id),
        "ticket_id": new_ticket.id,
        "ticket_subject": ticket_subject,
        "message": f"Assessment request submitted successfully. Track progress via Ticket #{new_ticket.id}"
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
    impersonate: UUID = None,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_active_user)
):
    ticket, contact = verify_ticket_access(ticket_id, current_user, db, impersonate)

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

    formatted_articles = [{
        "id": str(a.id),
        "title": a.title,
        "slug": a.slug,
        "identifier": a.identifier,
        "category": a.category
    } for a in ticket.articles]

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
        "assets": formatted_assets,
        "articles": formatted_articles
    }

@router.post("/tickets/{ticket_id}/comments")
def create_portal_comment(
    ticket_id: int,
    payload: schemas.CommentCreate, 
    background_tasks: BackgroundTasks,
    impersonate: UUID = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    ticket, contact = verify_ticket_access(ticket_id, current_user, db, impersonate)
    
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
    impersonate: UUID = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    ticket, _ = verify_ticket_access(ticket_id, current_user, db, impersonate)

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

@router.get("/articles/{slug}")
def get_portal_article(
    slug: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
    impersonate: UUID = None
):
    """Portal-facing article view. Access if article is linked to any ticket the user can see."""
    from sqlalchemy.orm import joinedload

    aid = resolve_portal_account_id(current_user, impersonate)

    article = db.query(models.Article).options(
        joinedload(models.Article.author)
    ).filter(models.Article.slug == slug).first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Verify access: article must be linked to at least one ticket belonging to this account
    if not is_impersonating(current_user, impersonate):
        linked = db.query(models.ticket_articles).join(
            models.Ticket, models.ticket_articles.c.ticket_id == models.Ticket.id
        ).filter(
            models.ticket_articles.c.article_id == article.id,
            models.Ticket.account_id == aid
        ).first()

        if not linked:
            raise HTTPException(status_code=403, detail="You do not have access to this article")

    return {
        "id": str(article.id),
        "title": article.title,
        "slug": article.slug,
        "identifier": article.identifier,
        "version": article.version,
        "category": article.category,
        "content": article.content,
        "author_name": article.author.full_name if article.author else "Unknown",
        "updated_at": article.updated_at.isoformat() if article.updated_at else
                      article.created_at.isoformat() if article.created_at else None
    }