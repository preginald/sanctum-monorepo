from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db
import subprocess
import os
from datetime import datetime
from fastapi.responses import FileResponse
from fastapi import BackgroundTasks
from pydantic import BaseModel

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    # Add other fields as needed

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

@router.put("/{user_id}", response_model=schemas.UserResponse)
def admin_update_user(
    user_id: str, 
    update: UserUpdate, # We define this simple schema locally or in schemas
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    if update.full_name: user.full_name = update.full_name
    if update.email: user.email = update.email
    
    db.commit()
    db.refresh(user)
    return user

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

# --- DATABASE BACKUP ---
@router.get("/backup", response_class=FileResponse)
def download_database_backup(
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_admin)
):
    # 1. Configuration
    # We grab credentials from the Environment (loaded by dotenv in main)
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=500, detail="Database configuration missing")

    # Parse URL for pg_dump (simplified parsing)
    # Assumes format: postgresql://user:pass@host/dbname
    try:
        # Very basic parsing logic, usually robust enough for standard conn strings
        from urllib.parse import urlparse
        url = urlparse(db_url)
        username = url.username
        password = url.password
        hostname = url.hostname
        port = url.port or "5432"
        dbname = url.path.lstrip("/")
    except Exception:
        raise HTTPException(status_code=500, detail="Could not parse database connection string")

    # 2. File Setup
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"sanctum_backup_{timestamp}.sql"
    filepath = f"/tmp/{filename}"

    # 3. Execute Dump
    # We pass PGPASSWORD as env var to avoid leaking it in process list
    env = os.environ.copy()
    env["PGPASSWORD"] = password

    command = [
        "pg_dump",
        "-h", hostname,
        "-p", str(port),
        "-U", username,
        "-F", "p", # Plain text SQL (easiest to audit/restore manually)
        "-f", filepath,
        dbname
    ]

    try:
        subprocess.run(command, env=env, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Backup failed: {e}")
        raise HTTPException(status_code=500, detail="Backup generation failed on server")
    except FileNotFoundError:
         raise HTTPException(status_code=500, detail="pg_dump utility not found on server")

    # 4. Cleanup Background Task
    def remove_file(path: str):
        try:
            os.remove(path)
        except Exception:
            pass

    background_tasks.add_task(remove_file, filepath)

    # 5. Serve File
    return FileResponse(
        path=filepath, 
        filename=filename, 
        media_type='application/sql'
    )