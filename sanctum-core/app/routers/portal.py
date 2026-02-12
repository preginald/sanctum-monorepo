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
from ..services.account_service import account_needs_questionnaire, get_account_lifecycle_stage

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

    # Helper to resolve UUID lists to Vendor Names for human-readable storage
    def resolve_vendor_names(vendor_ids):
        if not vendor_ids:
            return []
        vendors = db.query(models.Vendor).filter(models.Vendor.id.in_(vendor_ids)).all()
        return [v.name for v in vendors]

    # Resolve names from the catalog
    hosting_names = resolve_vendor_names(payload.hosting_providers)
    saas_names = resolve_vendor_names(payload.saas_platforms)
    antivirus_names = resolve_vendor_names(payload.antivirus)
    
    # Store questionnaire responses
    scoping_responses = {
        # Section 1: Technology
        "company_size": payload.company_size,
        "assessment_interest": payload.assessment_interest,
        "domain_names": payload.domain_names,
        "hosting_providers": hosting_names,  # Stores names for readability
        "saas_platforms": saas_names,        # Stores names for readability
        # Security (conditional)
        "antivirus": antivirus_names,
        "firewall_type": payload.firewall_type,
        "password_management": payload.password_management,
        "mfa_enabled": payload.mfa_enabled,
        "backup_solution": payload.backup_solution,
        # Section 2: Context
        "primary_pain_point": payload.primary_pain_point,
        "current_it_support": payload.current_it_support,
        "timeline": payload.timeline,
        "referral_source": payload.referral_source,
        "submitted_at": datetime.utcnow().isoformat(),
        "submitted_by": str(current_user.id)
    }
    
    if not account.audit_data:
        account.audit_data = {}
    
    account.audit_data['scoping_responses'] = scoping_responses
    
    # Parse and create draft assets
    draft_assets_created = []
    
    # 1. Parse domain names (Still uses newline split for the free-text tag input)
    if payload.domain_names:
        domains = [d.strip() for d in payload.domain_names.split('\n') if d.strip()]
        for domain_name in domains:
            asset = models.Asset(
                account_id=account.id,
                name=domain_name,
                asset_type='domain',
                status='draft',
                notes=f"Captured from Pre-Engagement Questionnaire - {datetime.utcnow().strftime('%Y-%m-%d')}"
            )
            db.add(asset)
            draft_assets_created.append(f"Domain: {domain_name}")
    
    # 2. Create hosting assets (Iterate resolved list)
    for provider_name in hosting_names:
        asset = models.Asset(
            account_id=account.id,
            name=f"Hosting Service",
            asset_type='hosting_web',
            vendor=provider_name,
            status='draft',
            notes=f"Captured from Pre-Engagement Questionnaire - {datetime.utcnow().strftime('%Y-%m-%d')}"
        )
        db.add(asset)
        draft_assets_created.append(f"Hosting: {provider_name}")
    
    # 3. Create SaaS assets (Iterate resolved list)
    for platform_name in saas_names:
        asset = models.Asset(
            account_id=account.id,
            name=platform_name,
            asset_type='saas',
            status='draft',
            notes=f"Captured from Pre-Engagement Questionnaire - {datetime.utcnow().strftime('%Y-%m-%d')}"
        )
        db.add(asset)
        draft_assets_created.append(f"SaaS: {platform_name}")
    
    # 4. Create security tool assets
    for av_name in antivirus_names:
        asset = models.Asset(
            account_id=account.id,
            name=f"Antivirus: {av_name}",
            asset_type='security_software',
            status='draft',
            notes=f"Captured from Pre-Engagement Questionnaire - {datetime.utcnow().strftime('%Y-%m-%d')}"
        )
        db.add(asset)
        draft_assets_created.append(f"Security: {av_name}")
    
    if payload.firewall_type and payload.firewall_type not in ['No', 'Not sure']:
        asset = models.Asset(
            account_id=account.id,
            name=f"Firewall: {payload.firewall_type}",
            asset_type='security_hardware',
            status='draft',
            notes=f"Captured from Pre-Engagement Questionnaire - {datetime.utcnow().strftime('%Y-%m-%d')}"
        )
        db.add(asset)
        draft_assets_created.append(f"Firewall: {payload.firewall_type}")
    
    if payload.password_management and payload.password_management not in ['Not sure']:
        asset = models.Asset(
            account_id=account.id,
            name=f"Password Management: {payload.password_management}",
            asset_type='saas',
            status='draft',
            notes=f"Captured from Pre-Engagement Questionnaire - {datetime.utcnow().strftime('%Y-%m-%d')}"
        )
        db.add(asset)
        draft_assets_created.append(f"Password Mgmt: {payload.password_management}")
    
    # Create internal review ticket
    ticket_description = f"""Pre-Engagement Questionnaire completed for {account.name}.

**SECTION 1: TECHNOLOGY ENVIRONMENT**
**Assessment Interest:** {payload.assessment_interest}
**Company Size:** {payload.company_size}

**SECTION 2: BUSINESS CONTEXT**
**Primary Pain Point:** {payload.primary_pain_point}
**Timeline:** {payload.timeline}
**Current IT Support:** {payload.current_it_support or 'Not specified'}
**Referral Source:** {payload.referral_source}

**SECURITY POSTURE** (if provided):
- Antivirus: {', '.join(antivirus_names) if antivirus_names else 'Not specified'}
- Firewall: {payload.firewall_type or 'Not specified'}
- Password Management: {payload.password_management or 'Not specified'}
- MFA Enabled: {payload.mfa_enabled or 'Not specified'}
- Backup Solution: {payload.backup_solution or 'Not specified'}

**DRAFT ASSETS CREATED:** {len(draft_assets_created)}
{chr(10).join(['- ' + asset for asset in draft_assets_created]) if draft_assets_created else '- None'}

**NEXT STEPS:**
1. Review draft assets and approve/edit
2. Contact client to schedule audit engagement
3. Prepare audit scope based on responses
"""
    
    ticket = models.Ticket(
        account_id=account.id,
        subject=f"[AUDIT INTAKE] Review Pre-Engagement Questionnaire - {account.name}",
        description=ticket_description,
        status='new',
        priority='normal',
        ticket_type='task'
    )
    db.add(ticket)
    db.flush()
    
    # Link primary contact to ticket
    primary_contact = db.query(models.Contact).filter(
        models.Contact.account_id == account.id,
        models.Contact.is_primary_contact == True
    ).first()
    
    if primary_contact:
        db.execute(
            ticket_contacts.insert().values(
                ticket_id=ticket.id,
                contact_id=primary_contact.id
            )
        )
    
    # Task 1: Review & Approve Draft Assets (High priority)
    task1 = models.Ticket(
        account_id=account.id,
        subject=f"Review & Approve Draft Assets - {account.name}",
        description=f"""Review {len(draft_assets_created)} draft assets created from questionnaire.

**Assets to Review:**
{chr(10).join(['- ' + asset for asset in draft_assets_created])}

**Actions Required:**
1. Verify accuracy of captured information
2. Approve assets or edit details as needed
3. Check for duplicates
4. Add any missing asset details (serial numbers, purchase dates, etc.)

**Related Ticket:** #{ticket.id} - [AUDIT INTAKE] Review Pre-Engagement Questionnaire""",
        status='new',
        priority='high',
        ticket_type='task'
    )
    db.add(task1)
    
    # Task 2: Schedule Client Engagement
    task2 = models.Ticket(
        account_id=account.id,
        subject=f"Schedule Engagement - {account.name}",
        description=f"""Contact client to schedule audit engagement.

**Client Timeline:** {payload.timeline}
**Assessment Interest:** {payload.assessment_interest}

**Actions Required:**
1. Call or email client within 48 hours
2. Schedule initial consultation/kickoff meeting
3. Discuss assessment scope and timeline
4. Send calendar invite and confirmation

**Primary Pain Point:** {payload.primary_pain_point}

**Related Ticket:** #{ticket.id} - [AUDIT INTAKE] Review Pre-Engagement Questionnaire""",
        status='new',
        priority='normal',
        ticket_type='task'
    )
    db.add(task2)
    
    if primary_contact:
        db.execute(ticket_contacts.insert().values(ticket_id=task2.id, contact_id=primary_contact.id))
    
    # Task 3: Prepare Audit Scope
    task3 = models.Ticket(
        account_id=account.id,
        subject=f"Prepare Audit Scope - {account.name}",
        description=f"""Based on questionnaire responses, prepare detailed audit scope document.

**Assessment Type:** {payload.assessment_interest}

**Environment Overview:**
- Company Size: {payload.company_size}
- Domains: {len(payload.domain_names.split(chr(10))) if payload.domain_names else 0}
- Hosting Providers: {len(hosting_names)}
- SaaS Platforms: {len(saas_names)}

**Actions Required:**
1. Review all questionnaire responses and draft assets
2. Prepare scope of work document
3. Include pricing estimate based on environment size
4. Define deliverables and timeline

**Related Ticket:** #{ticket.id} - [AUDIT INTAKE] Review Pre-Engagement Questionnaire""",
        status='new',
        priority='normal',
        ticket_type='task'
    )
    db.add(task3)
    
    db.commit()
    
    # Fire event for notifications
    event_bus.emit("questionnaire_completed", ticket, background_tasks)
    
    return {
        "status": "success",
        "message": "Questionnaire submitted successfully",
        "ticket_id": ticket.id,
        "follow_up_tasks_created": 3,
        "draft_assets_created": len(draft_assets_created),
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