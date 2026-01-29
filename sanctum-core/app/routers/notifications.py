from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, auth
from ..database import get_db

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