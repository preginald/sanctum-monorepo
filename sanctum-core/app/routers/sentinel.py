from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from uuid import UUID
from .. import models, database
from typing import Optional, Dict, List
from datetime import datetime

class TemplateListResponse(BaseModel):
    id: UUID
    name: str
    framework: str
    description: Optional[str]
    
    class Config:
        from_attributes = True

class AuditSubmissionRequest(BaseModel):
    template_id: UUID
    responses: Dict[str, Dict[str, str]]  # {control_id: {status: "pass/fail/partial/na", notes: "..."}}

class AuditDetailResponse(BaseModel):
    id: UUID
    account_id: UUID
    template_id: Optional[UUID]
    security_score: int
    status: str
    template_name: Optional[str]
    responses: Optional[Dict[str, Dict[str, str]]]
    category_structure: Optional[List[Dict]]
    
    class Config:
        from_attributes = True

router = APIRouter(prefix="/sentinel", tags=["Sentinel"])

class DeepScanRequest(BaseModel):
    audit_id: UUID
    target_url: str

@router.get("/templates", response_model=List[TemplateListResponse])
def list_audit_templates(db: Session = Depends(database.get_db)):
    """
    Returns all active audit templates (Essential 8, NIST CSF, etc.)
    """
    templates = db.query(models.AuditTemplate).filter(
        models.AuditTemplate.is_active == True
    ).all()
    
    return templates

@router.post("/scan")
def queue_sentinel_scan(payload: DeepScanRequest, db: Session = Depends(database.get_db)):
    """
    Queues a background deep scan for the Sentinel Engine.
    The worker will pick this up and perform SSL, DNS, SEO, and Tech checks.
    """
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == payload.audit_id).first()
    
    if not audit:
        raise HTTPException(status_code=404, detail="Audit report not found")

    if audit.status == 'finalized':
        raise HTTPException(status_code=400, detail="Cannot scan a finalized report")

    # Update state for the background worker
    audit.target_url = payload.target_url
    audit.scan_status = 'queued'
    
    db.commit()
    
    return {"status": "queued", "message": f"Scan initiated for {payload.target_url}"}

@router.get("/status/{audit_id}")
def get_scan_status(audit_id: UUID, db: Session = Depends(database.get_db)):
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
        
    return {
        "audit_id": audit_id,
        "scan_status": audit.scan_status,
        "last_scan_at": audit.last_scan_at
    }

@router.get("/audits/{audit_id}", response_model=AuditDetailResponse)
def get_audit_detail(audit_id: UUID, db: Session = Depends(database.get_db)):
    """
    Returns audit report with template structure and submitted responses.
    """
    audit = db.query(models.AuditReport).filter(
        models.AuditReport.id == audit_id
    ).first()
    
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    # Get submission if exists
    submission = db.query(models.AuditSubmission).filter(
        models.AuditSubmission.audit_report_id == audit_id
    ).first()
    
    # Get template details
    template_name = None
    category_structure = None
    responses = None
    
    if audit.template_id:
        template = db.query(models.AuditTemplate).filter(
            models.AuditTemplate.id == audit.template_id
        ).first()
        if template:
            template_name = template.name
            category_structure = template.category_structure
    
    if submission:
        responses = submission.responses
    
    return {
        "id": audit.id,
        "account_id": audit.account_id,
        "template_id": audit.template_id,
        "security_score": audit.security_score,
        "status": audit.status,
        "template_name": template_name,
        "category_structure": category_structure,
        "responses": responses
    }

@router.post("/audits/{audit_id}/submit")
def submit_audit_responses(
    audit_id: UUID,
    payload: AuditSubmissionRequest,
    db: Session = Depends(database.get_db)
):
    """
    Submits or updates audit responses and recalculates security score.
    """
    from ..auth import get_current_user
    
    audit = db.query(models.AuditReport).filter(
        models.AuditReport.id == audit_id
    ).first()
    
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    if audit.status == 'finalized':
        raise HTTPException(status_code=400, detail="Cannot modify finalized audit")
    
    # Get template to validate controls and calculate score
    template = db.query(models.AuditTemplate).filter(
        models.AuditTemplate.id == payload.template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Calculate weighted score
    total_weight = 0
    earned_weight = 0.0
    
    for category in template.category_structure:
        for control in category.get('controls', []):
            control_id = control['id']
            weight = control.get('weight', 1)
            
            response = payload.responses.get(control_id, {})
            status = response.get('status', 'fail')
            
            if status != 'na':  # Exclude N/A from scoring
                total_weight += weight
                
                if status == 'pass':
                    earned_weight += weight
                elif status == 'partial':
                    earned_weight += (weight * 0.5)
    
    # Calculate percentage
    security_score = 0
    if total_weight > 0:
        security_score = int((earned_weight / total_weight) * 100)
    
    # Update audit report
    audit.template_id = payload.template_id
    audit.security_score = security_score
    
    # Create or update submission
    submission = db.query(models.AuditSubmission).filter(
        models.AuditSubmission.audit_report_id == audit_id
    ).first()
    
    if submission:
        submission.template_id = payload.template_id
        submission.responses = payload.responses
        submission.updated_at = datetime.utcnow()
    else:
        submission = models.AuditSubmission(
            audit_report_id=audit_id,
            template_id=payload.template_id,
            responses=payload.responses
        )
        db.add(submission)
    
    db.commit()
    db.refresh(audit)
    
    return {
        "audit_id": audit_id,
        "security_score": security_score,
        "status": "success"
    }