from uuid import uuid4
import secrets
import os
from fastapi import APIRouter, Depends, HTTPException, Form
import pyotp
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
from datetime import timedelta, datetime, timezone # Added timezone
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(tags=["Authentication"])

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(
        form_data: OAuth2PasswordRequestForm = Depends(), 
    otp: Optional[str] = Form(None), 
    db: Session = Depends(get_db)
):
    print(f"--- LOGIN ATTEMPT: {form_data.username} ---")
    
    # 1. Fetch User
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not user:
        print("--- RESULT: User Not Found ---")
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    print(f"--- USER FOUND: {user.id} ---")
    
    # 2. Verify Password
    is_valid = auth.verify_password(form_data.password, user.password_hash)
    print(f"--- PASSWORD VALID: {is_valid} ---")
    
    if not is_valid:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    # 2FA CHECK
    if user.totp_secret:
        if not otp:
            # Tell Frontend to ask for code
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

@router.post("/2fa/setup", response_model=schemas.TwoFASetupResponse)
def setup_two_factor(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    # Generate a random secret
    secret = pyotp.random_base32()
    
    # Generate URI for QR Code (Issuer: Digital Sanctum)
    uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=current_user.email, 
        issuer_name="Digital Sanctum"
    )
    
    return {"secret": secret, "qr_uri": uri}

@router.post("/2fa/enable")
def enable_two_factor(
    payload: schemas.TwoFAVerify, # Contains 'code' and implicitly the secret is in session? 
    # Actually, stateless API means we can't store the secret in session. 
    # We must trust the user to send the secret back OR update the model tentatively.
    # Better pattern: Client sends secret AND code to verify.
    secret: str, # passed via query or body
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Verify
    totp = pyotp.TOTP(secret)
    if not totp.verify(payload.code):
        raise HTTPException(status_code=400, detail="Invalid Code")
    
    # Save Secret to User
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
    current_user: models.User = Depends(auth.get_current_active_user), # Only logged in users can invite
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    # Generate Token
    raw_token = secrets.token_urlsafe(32)
    token_hash = auth.get_password_hash(raw_token) # FIX

    expiry = datetime.now(timezone.utc) + timedelta(hours=24)
    
    db_token = models.PasswordToken(
        user_id=user.id,
        token=raw_token,
        token_hash=token_hash, # FIX
        expires_at=expiry
    )
    db.add(db_token)
    db.commit()
    
    # Send Email
    # FIX: Dynamic URL
    base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    link = f"{base_url}/auth/set-password?token={raw_token}"
    
    email_service.send(
        user.email,
        "Welcome to Sanctum - Set Your Password",
        f"""
        <h1>Welcome, {user.full_name}</h1>
        <p>You have been invited to the Digital Sanctum Client Portal.</p>
        <p>Click the link below to set your secure password and enable 2FA.</p>
        <p><a href="{link}">Set Password & Access Portal</a></p>
        <p>This link expires in 24 hours.</p>
        """
    )
    
    return {"status": "invited", "expires_at": expiry}

@router.post("/set-password")
def set_password(payload: schemas.PasswordSetRequest, db: Session = Depends(get_db)):
    print(f"--- ATTEMPTING PASSWORD RESET Token: {payload.token[:5]}... ---")
    
    # 1. Find Token
    token_record = db.query(models.PasswordToken).filter(
        models.PasswordToken.token == payload.token,
        models.PasswordToken.used == False,
        models.PasswordToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not token_record:
        print("--- TOKEN INVALID/EXPIRED ---")
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    # 2. Update User
    user = db.query(models.User).filter(models.User.id == token_record.user_id).first()
    
    # Hash new password
    new_hash = auth.get_password_hash(payload.new_password)
    print(f"--- UPDATING USER {user.email} ---")
    print(f"--- OLD HASH: {user.password_hash[:10]}... ---")
    print(f"--- NEW HASH: {new_hash[:10]}... ---")
    
    user.password_hash = new_hash
    user.is_active = True
    
    # 3. Invalidate Token
    token_record.used = True
    
    db.commit()
    print("--- COMMIT SUCCESSFUL ---")
    return {"status": "password_updated", "email": user.email}

@router.get("/verify-invite")
def verify_invite_token(token: str, db: Session = Depends(get_db)):
    print(f"--- VERIFYING TOKEN: {token} ---")
    
    # 1. Check if token exists AT ALL (ignore expiry for debug)
    raw_check = db.query(models.PasswordToken).filter(models.PasswordToken.token == token).first()
    if not raw_check:
        print("--- TOKEN NOT FOUND IN DB ---")
        # Dump DB content to see what's there
        all_tokens = db.query(models.PasswordToken.token).all()
        print(f"--- AVAILABLE TOKENS: {all_tokens} ---")
        raise HTTPException(status_code=400, detail="Invalid token (Not Found)")
        
    print(f"--- TOKEN FOUND. Expires: {raw_check.expires_at} vs Now: {datetime.now(timezone.utc)} ---")
    
    # 2. Check Expiry/Used
    if raw_check.used:
        print("--- TOKEN USED ---")
        raise HTTPException(status_code=400, detail="Token already used")
        
    if raw_check.expires_at < datetime.now(timezone.utc):
        print("--- TOKEN EXPIRED ---")
        raise HTTPException(status_code=400, detail="Token expired")
    
    # 3. Check User
    user = db.query(models.User).filter(models.User.id == raw_check.user_id).first()
    if not user:
        print(f"--- USER {raw_check.user_id} NOT FOUND ---")
        raise HTTPException(status_code=404, detail="User not found")
        
    print(f"--- SUCCESS: {user.email} ---")
    return {"email": user.email, "full_name": user.full_name}