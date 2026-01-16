from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, auth
from ..database import get_db

# PREFIX: /admin/users
router = APIRouter(prefix="/admin/users", tags=["Admin"])

# DEPENDENCY: Strict Admin Check
def get_current_admin(current_user: models.User = Depends(auth.get_current_active_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user

@router.get("", response_model=List[schemas.UserResponse])
def list_all_users(
    current_user: models.User = Depends(get_current_admin), # Guarded
    db: Session = Depends(get_db)
):
    # Return all users (Tech + Clients)
    return db.query(models.User).order_by(models.User.role, models.User.full_name).all()

@router.post("", response_model=schemas.UserResponse)
def create_user(
    user_data: schemas.ClientUserCreate, 
    role: str = "tech", # 'tech' or 'admin' (clients created via ClientDetail)
    access_scope: str = "global",
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = auth.get_password_hash(user_data.password)
    new_user = models.User(
        email=user_data.email, 
        password_hash=hashed_pw, 
        full_name=user_data.full_name, 
        role=role, 
        access_scope=access_scope
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/{user_id}/reset_password")
def admin_reset_password(
    user_id: str, 
    payload: schemas.ClientUserCreate, # Reusing schema for convenience (just need password)
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    user.password_hash = auth.get_password_hash(payload.password)
    db.commit()
    return {"status": "password_reset"}

@router.delete("/{user_id}")
def admin_delete_user(
    user_id: str,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if str(current_user.id) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return {"status": "deleted"}