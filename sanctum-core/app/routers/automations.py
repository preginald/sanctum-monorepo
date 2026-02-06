from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/admin/automations", tags=["Automations"])

# Security: Only Admins can touch the wiring
def get_admin(user: models.User = Depends(auth.get_current_active_user)):
    if user.role != 'admin': raise HTTPException(status_code=403, detail="Admin Only")
    return user

@router.get("", response_model=List[schemas.AutomationResponse])
def list_automations(db: Session = Depends(get_db), _: models.User = Depends(get_admin)):
    return db.query(models.Automation).all()

@router.get("/logs", response_model=List[schemas.AutomationLogResponse])
def get_global_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _: models.User = Depends(get_admin)):
    """
    The Panopticon: View execution history across ALL rules.
    """
    logs = db.query(models.AutomationLog)\
        .options(joinedload(models.AutomationLog.automation))\
        .order_by(models.AutomationLog.triggered_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    # Enrich with Automation Name
    results = []
    for log in logs:
        # Clone dict to avoid mutating DB object state if needed, 
        # though Pydantic reads attributes fine. We explicitly set the name field.
        # Note: SQLAlchemy objects are not dicts, so we construct the response data.
        log_data = {
            "id": log.id,
            "automation_id": log.automation_id,
            "triggered_at": log.triggered_at,
            "status": log.status,
            "output": log.output,
            "automation_name": log.automation.name if log.automation else "Unknown Rule"
        }
        results.append(log_data)
        
    return results

@router.post("", response_model=schemas.AutomationResponse)
def create_automation(auto: schemas.AutomationCreate, db: Session = Depends(get_db), _: models.User = Depends(get_admin)):
    new_auto = models.Automation(**auto.model_dump())
    db.add(new_auto)
    db.commit()
    db.refresh(new_auto)
    return new_auto

@router.put("/{auto_id}", response_model=schemas.AutomationResponse)
def update_automation(auto_id: UUID, update: schemas.AutomationUpdate, db: Session = Depends(get_db), _: models.User = Depends(get_admin)):
    auto = db.query(models.Automation).filter(models.Automation.id == auto_id).first()
    if not auto: raise HTTPException(status_code=404, detail="Automation not found")
    
    for k, v in update.model_dump(exclude_unset=True).items():
        setattr(auto, k, v)
        
    db.commit()
    db.refresh(auto)
    return auto

@router.delete("/{auto_id}")
def delete_automation(auto_id: UUID, db: Session = Depends(get_db), _: models.User = Depends(get_admin)):
    auto = db.query(models.Automation).filter(models.Automation.id == auto_id).first()
    if not auto: raise HTTPException(status_code=404, detail="Automation not found")
    db.delete(auto)
    db.commit()
    return {"status": "deleted"}

@router.get("/{auto_id}/logs", response_model=List[schemas.AutomationLogResponse])
def get_automation_logs(auto_id: UUID, db: Session = Depends(get_db), _: models.User = Depends(get_admin)):
    logs = db.query(models.AutomationLog).options(joinedload(models.AutomationLog.automation)).filter(models.AutomationLog.automation_id == auto_id).order_by(models.AutomationLog.triggered_at.desc()).limit(50).all()
    
    # Consistent enrichment for single view as well
    results = []
    for log in logs:
        log_data = {
            "id": log.id,
            "automation_id": log.automation_id,
            "triggered_at": log.triggered_at,
            "status": log.status,
            "output": log.output,
            "automation_name": log.automation.name if log.automation else "Unknown Rule"
        }
        results.append(log_data)
    return results