from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from uuid import UUID
from .. import models, database

router = APIRouter(prefix="/sentinel", tags=["Sentinel"])

class DeepScanRequest(BaseModel):
    audit_id: UUID
    target_url: str

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