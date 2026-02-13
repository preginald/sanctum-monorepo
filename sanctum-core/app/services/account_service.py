"""
Account Service - Business Logic for Account Management
"""
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from .. import models, schemas
from ..models import ticket_contacts

def account_needs_questionnaire(account: models.Account, db: Session) -> bool:
    """
    Determine if an account needs to complete the Pre-Engagement Questionnaire.
    """
    if account.audit_data and account.audit_data.get('scoping_responses'):
        return False
    
    completed_audits = db.query(models.AuditReport).filter(
        models.AuditReport.account_id == account.id,
        models.AuditReport.status == 'finalized'
    ).count()
    if completed_audits > 0: return False
    
    asset_count = db.query(models.Asset).filter(models.Asset.account_id == account.id).count()
    if asset_count > 0: return False
    
    deal_count = db.query(models.Deal).filter(models.Deal.account_id == account.id).count()
    if deal_count > 0: return False
    
    return True

def get_account_lifecycle_stage(account: models.Account, db: Session) -> str:
    """
    Determine account lifecycle stage.
    """
    if account.audit_data and account.audit_data.get('scoping_responses'):
        completed_audits = db.query(models.AuditReport).filter(
            models.AuditReport.account_id == account.id,
            models.AuditReport.status == 'finalized'
        ).count()
        if completed_audits == 0: return 'onboarding'
        else: return 'active'
    
    has_assets = db.query(models.Asset).filter(models.Asset.account_id == account.id).count() > 0
    has_deals = db.query(models.Deal).filter(models.Deal.account_id == account.id).count() > 0
    has_audits = db.query(models.AuditReport).filter(models.AuditReport.account_id == account.id).count() > 0
    
    if has_assets or has_deals or has_audits: return 'active'
    
    return 'prospect'

def process_questionnaire_submission(
    db: Session,
    account: models.Account,
    payload: schemas.QuestionnaireSubmit,
    submitted_by_user_id: UUID,
    create_tickets: bool = True
) -> dict:
    """
    Core Logic: Processes a questionnaire submission.
    1. Updates Account.audit_data
    2. Creates Draft Assets (Domains, Hosting, SaaS, etc)
    3. Creates Review Tickets (Optional)
    
    Returns: dict containing 'ticket' (if created) and 'draft_assets_count'
    """
    
    # Helper to resolve UUID lists to Vendor Names
    def resolve_vendor_names(vendor_ids):
        if not vendor_ids: return []
        vendors = db.query(models.Vendor).filter(models.Vendor.id.in_(vendor_ids)).all()
        return [v.name for v in vendors]

    # Resolve names
    hosting_names = resolve_vendor_names(payload.hosting_providers)
    saas_names = resolve_vendor_names(payload.saas_platforms)
    antivirus_names = resolve_vendor_names(payload.antivirus)
    
    # Update Audit Data
    scoping_responses = {
        "company_size": payload.company_size,
        "assessment_interest": payload.assessment_interest,
        "domain_names": payload.domain_names,
        "hosting_providers": hosting_names,
        "saas_platforms": saas_names,
        "antivirus": antivirus_names,
        "firewall_type": payload.firewall_type,
        "password_management": payload.password_management,
        "mfa_enabled": payload.mfa_enabled,
        "backup_solution": payload.backup_solution,
        "primary_pain_point": payload.primary_pain_point,
        "current_it_support": payload.current_it_support,
        "timeline": payload.timeline,
        "referral_source": payload.referral_source,
        "submitted_at": datetime.utcnow().isoformat(),
        "submitted_by": str(submitted_by_user_id)
    }
    
    if not account.audit_data: account.audit_data = {}
    # Force a new dict assignment to ensure SQLAlchemy detects change
    new_audit_data = account.audit_data.copy()
    new_audit_data['scoping_responses'] = scoping_responses
    account.audit_data = new_audit_data
    
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(account, "audit_data")
    
    # Create Draft Assets
    draft_assets_created = []
    timestamp = datetime.utcnow().strftime('%Y-%m-%d')
    note_suffix = f"Captured from Questionnaire - {timestamp}"

    # Domains
    if payload.domain_names:
        domains = [d.strip() for d in payload.domain_names.split('\n') if d.strip()]
        for domain_name in domains:
            db.add(models.Asset(
                account_id=account.id, name=domain_name, asset_type='domain',
                status='draft', notes=note_suffix
            ))
            draft_assets_created.append(f"Domain: {domain_name}")
            
    # Hosting
    for name in hosting_names:
        db.add(models.Asset(
            account_id=account.id, name=f"Hosting Service", asset_type='hosting web',
            vendor=name, status='draft', notes=note_suffix
        ))
        draft_assets_created.append(f"Hosting: {name}")
        
    # SaaS
    for name in saas_names:
        db.add(models.Asset(
            account_id=account.id, name=name, asset_type='saas',
            status='draft', notes=note_suffix
        ))
        draft_assets_created.append(f"SaaS: {name}")

    # Security
    for name in antivirus_names:
        db.add(models.Asset(
            account_id=account.id, name=f"Antivirus: {name}", asset_type='security software',
            status='draft', notes=note_suffix
        ))
        draft_assets_created.append(f"Security: {name}")

    if payload.firewall_type and payload.firewall_type not in ['No', 'Not sure']:
        db.add(models.Asset(
            account_id=account.id, name=f"Firewall: {payload.firewall_type}", asset_type='firewall',
            status='draft', notes=note_suffix
        ))
        draft_assets_created.append(f"Firewall: {payload.firewall_type}")
        
    if payload.password_management and payload.password_management not in ['Not sure']:
        db.add(models.Asset(
            account_id=account.id, name=f"Password Mgmt: {payload.password_management}", asset_type='saas',
            status='draft', notes=note_suffix
        ))
        draft_assets_created.append(f"Password Mgmt: {payload.password_management}")

    # Ticket Logic
    ticket = None
    if create_tickets:
        ticket_description = f"""Questionnaire completed for {account.name}.

**TECHNOLOGY:**
- Size: {payload.company_size}
- Domains: {len(draft_assets_created)} assets created

**CONTEXT:**
- Pain Point: {payload.primary_pain_point}
- Timeline: {payload.timeline}

**ASSETS CREATED:** {len(draft_assets_created)}
"""
        ticket = models.Ticket(
            account_id=account.id,
            subject=f"[AUDIT INTAKE] Review Questionnaire - {account.name}",
            description=ticket_description,
            status='new',
            priority='normal',
            ticket_type='task'
        )
        db.add(ticket)
        db.flush() # get ID
        
        # Tasks
        task1 = models.Ticket(
            account_id=account.id, subject=f"Review Draft Assets - {account.name}",
            description=f"Review and approve {len(draft_assets_created)} draft assets.",
            status='new', priority='high', ticket_type='task'
        )
        db.add(task1)
        
        # Link Primary Contact if exists
        primary_contact = db.query(models.Contact).filter(
            models.Contact.account_id == account.id,
            models.Contact.is_primary_contact == True
        ).first()
        
        if primary_contact:
            db.execute(ticket_contacts.insert().values(ticket_id=ticket.id, contact_id=primary_contact.id))

    db.commit()
    
    return {
        "ticket": ticket,
        "draft_assets_count": len(draft_assets_created)
    }
