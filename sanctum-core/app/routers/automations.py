from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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
    return db.query(models.AutomationLog).filter(models.AutomationLog.automation_id == auto_id).order_by(models.AutomationLog.triggered_at.desc()).limit(50).all()
