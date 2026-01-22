from fastapi import APIRouter, Depends, HTTPException, Form
import pyotp
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
from datetime import timedelta
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(tags=["Authentication"])

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    otp: Optional[str] = Form(None), # Allow extra form field
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
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
