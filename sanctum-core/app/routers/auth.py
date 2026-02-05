from uuid import uuid4
import secrets
import os
from fastapi import APIRouter, Depends, HTTPException, Form, Body 
import pyotp
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
from datetime import timedelta, datetime, timezone
from .. import models, schemas, auth
from ..database import get_db
from ..services.auth_service import auth_service
from ..services.email_service import email_service # <--- NEW IMPORT

router = APIRouter(tags=["Authentication"])

# --- EXISTING LOGIN ENDPOINTS (UNCHANGED) ---
@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    otp: Optional[str] = Form(None), 
    db: Session = Depends(get_db)
):
    print(f"--- LOGIN ATTEMPT: {form_data.username} ---")
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not user:
        print("--- RESULT: User Not Found ---")
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    print(f"--- USER FOUND: {user.id} ---")
    is_valid = auth.verify_password(form_data.password, user.password_hash)
    print(f"--- PASSWORD VALID: {is_valid} ---")
    
    if not is_valid:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    if user.totp_secret:
        if not otp:
            raise HTTPException(
                status_code=401, 
                detail="2FA_REQUIRED",
                headers={"X-Sanctum-2FA": "Required"}
            )
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(otp):
             raise HTTPException(status_code=401, detail="Invalid 2FA Code")

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_payload = {
        "sub": user.email, 
        "scope": user.access_scope,
        "role": user.role,
        "id": str(user.id),
        "account_id": str(user.account_id) if user.account_id else None
    }
    access_token = auth.create_access_token(
        data=token_payload,
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh", response_model=schemas.Token)
def refresh_session(current_user: models.User = Depends(auth.get_current_active_user)):
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_payload = {
        "sub": current_user.email, 
        "scope": current_user.access_scope,
        "role": current_user.role,
        "id": str(current_user.id),
        "account_id": str(current_user.account_id) if current_user.account_id else None
    }
    access_token = auth.create_access_token(
        data=token_payload,
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- 2FA ENDPOINTS (UNCHANGED) ---
@router.post("/2fa/setup", response_model=schemas.TwoFASetupResponse)
def setup_two_factor(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    secret = pyotp.random_base32()
    uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=current_user.email, 
        issuer_name="Digital Sanctum"
    )
    return {"secret": secret, "qr_uri": uri}

@router.post("/2fa/enable")
def enable_two_factor(
    payload: schemas.TwoFAVerify, 
    secret: str, 
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    totp = pyotp.TOTP(secret)
    if not totp.verify(payload.code):
        raise HTTPException(status_code=400, detail="Invalid Code")
    current_user.totp_secret = secret
    db.commit()
    return {"status": "2FA Enabled"}

@router.post("/2fa/disable")
def disable_two_factor(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    current_user.totp_secret = None
    db.commit()
    return {"status": "2FA Disabled"}

@router.post("/invite")
def invite_user(
    payload: schemas.InviteRequest,
    current_user: models.User = Depends(auth.get_current_active_user), 
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    auth_service.invite_user(db, user)
    return {"status": "invited", "message": f"Invitation sent to {user.email}"}

# --- PASSWORD RESET FLOW ---

@router.post("/request-reset")
def request_password_reset(email: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """
    1. Check if user exists.
    2. Generate PasswordToken.
    3. Send Email.
    """
    user = db.query(models.User).filter(models.User.email == email).first()
    
    # Security: Always return success to prevent email enumeration
    if not user:
        return {"status": "request_received", "message": "If this email exists, a reset link has been sent."}
    
    # 1. Generate Token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    
    # 2. Save to DB
    # Note: Using token as the hash for now since the existing set-password logic queries by token.
    token_record = models.PasswordToken(
        user_id=user.id,
        token=token,
        token_hash=token, # Required field in DB
        expires_at=expires_at,
        used=False
    )
    db.add(token_record)
    db.commit()
    
    # 3. Send Email
    # Construct Link (Assumes frontend is on port 5173 or configured domain)
    # Ideally use an ENV var for FRONTEND_URL
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/set-password?token={token}"
    
    email_service.send(
        to_emails=[user.email],
        subject="Reset Your Password - Sanctum",
        html_content=f"""
        <h1>Password Reset Request</h1>
        <p>A request was made to reset the password for {user.email}.</p>
        <p>Click the link below to set a new password:</p>
        <p><a href="{reset_link}">Reset Password</a></p>
        <p>This link expires in 24 hours.</p>
        <p>If you did not request this, please ignore this email.</p>
        """
    )
    
    return {"status": "request_received", "message": "If this email exists, a reset link has been sent."}


@router.post("/set-password")
def set_password(payload: schemas.PasswordSetRequest, db: Session = Depends(get_db)):
    print(f"--- ATTEMPTING PASSWORD RESET Token: {payload.token[:5]}... ---")
    token_record = db.query(models.PasswordToken).filter(
        models.PasswordToken.token == payload.token,
        models.PasswordToken.used == False,
        models.PasswordToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not token_record:
        print("--- TOKEN INVALID/EXPIRED ---")
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    user = db.query(models.User).filter(models.User.id == token_record.user_id).first()
    new_hash = auth.get_password_hash(payload.new_password)
    
    user.password_hash = new_hash
    user.is_active = True
    token_record.used = True
    
    db.commit()
    return {"status": "password_updated", "email": user.email}

@router.get("/verify-invite")
def verify_invite_token(token: str, db: Session = Depends(get_db)):
    print(f"--- VERIFYING TOKEN: {token} ---")
    raw_check = db.query(models.PasswordToken).filter(models.PasswordToken.token == token).first()
    if not raw_check:
        raise HTTPException(status_code=400, detail="Invalid token (Not Found)")
        
    if raw_check.used:
        raise HTTPException(status_code=400, detail="Token already used")
        
    if raw_check.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    
    user = db.query(models.User).filter(models.User.id == raw_check.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"email": user.email, "full_name": user.full_name}