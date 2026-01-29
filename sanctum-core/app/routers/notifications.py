from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, auth
from ..database import get_db
from ..models import UserNotificationPreference # Ensure this is imported


router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[schemas.NotificationResponse])
def get_notifications(
    limit: int = 20, 
    unread_only: bool = False,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_active_user)
):
    query = db.query(models.Notification).filter(models.Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.filter(models.Notification.is_read == False)
        
    return query.order_by(models.Notification.created_at.desc()).limit(limit).all()

@router.get("/count")
def get_unread_count(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_active_user)
):
    count = db.query(models.Notification)\
        .filter(models.Notification.user_id == current_user.id, models.Notification.is_read == False)\
        .count()
    return {"count": count}

@router.put("/{note_id}/read")
def mark_as_read(note_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    note = db.query(models.Notification).filter(models.Notification.id == note_id, models.Notification.user_id == current_user.id).first()
    if not note: raise HTTPException(status_code=404, detail="Notification not found")
    
    note.is_read = True
    db.commit()
    return {"status": "updated"}

@router.put("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db.query(models.Notification)\
        .filter(models.Notification.user_id == current_user.id, models.Notification.is_read == False)\
        .update({models.Notification.is_read: True})
    db.commit()
    return {"status": "all_updated"}

# --- PREFERENCE CONTROLS ---

@router.get("/preferences", response_model=schemas.PreferenceResponse)
def get_preferences(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_active_user)
):
    prefs = current_user.notification_preferences
    if not prefs:
        # Return defaults if no record exists
        return {"email_frequency": "realtime", "force_critical": True}
    return prefs

@router.put("/preferences", response_model=schemas.PreferenceResponse)
def update_preferences(
    prefs_update: schemas.PreferenceUpdate,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_active_user)
):
    prefs = current_user.notification_preferences
    if not prefs:
        # Create if missing
        prefs = models.UserNotificationPreference(user_id=current_user.id)
        db.add(prefs)
    
    prefs.email_frequency = prefs_update.email_frequency
    prefs.force_critical = prefs_update.force_critical
    
    db.commit()
    db.refresh(prefs)
    return prefs