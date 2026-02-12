"""
Account Service - Business Logic for Account Management
"""
from sqlalchemy.orm import Session
from uuid import UUID
from .. import models

def account_needs_questionnaire(account: models.Account, db: Session) -> bool:
    """
    Determine if an account needs to complete the Pre-Engagement Questionnaire.
    
    Returns False (skip questionnaire) if:
    - Account has already completed questionnaire
    - Account has finalized audits
    - Account has assets in the register
    - Account has deal history
    
    Returns True (show questionnaire) for new prospects.
    """
    
    # Check 1: Has completed questionnaire?
    if account.audit_data and account.audit_data.get('scoping_responses'):
        return False
    
    # Check 2: Has any finalized audits?
    completed_audits = db.query(models.AuditReport).filter(
        models.AuditReport.account_id == account.id,
        models.AuditReport.status == 'finalized'
    ).count()
    if completed_audits > 0:
        return False
    
    # Check 3: Has assets in register?
    asset_count = db.query(models.Asset).filter(
        models.Asset.account_id == account.id
    ).count()
    if asset_count > 0:
        return False
    
    # Check 4: Has any deal history?
    deal_count = db.query(models.Deal).filter(
        models.Deal.account_id == account.id
    ).count()
    if deal_count > 0:
        return False
    
    # Default: This is a new prospect - show questionnaire
    return True


def get_account_lifecycle_stage(account: models.Account, db: Session) -> str:
    """
    Determine account lifecycle stage.
    
    Returns:
    - 'prospect': New account, needs questionnaire
    - 'onboarding': Questionnaire completed, awaiting audit
    - 'active': Has completed audits or established history
    """
    
    # Has completed questionnaire but no finalized audits
    if account.audit_data and account.audit_data.get('scoping_responses'):
        completed_audits = db.query(models.AuditReport).filter(
            models.AuditReport.account_id == account.id,
            models.AuditReport.status == 'finalized'
        ).count()
        
        if completed_audits == 0:
            return 'onboarding'
        else:
            return 'active'
    
    # Check if account has history (skip prospect stage)
    has_assets = db.query(models.Asset).filter(
        models.Asset.account_id == account.id
    ).count() > 0
    
    has_deals = db.query(models.Deal).filter(
        models.Deal.account_id == account.id
    ).count() > 0
    
    has_audits = db.query(models.AuditReport).filter(
        models.AuditReport.account_id == account.id
    ).count() > 0
    
    if has_assets or has_deals or has_audits:
        return 'active'
    
    # Default: New prospect
    return 'prospect'
