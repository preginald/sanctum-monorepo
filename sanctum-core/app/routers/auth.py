from uuid import uuid4
import os
from fastapi import APIRouter, Depends, HTTPException
import pyotp
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, timezone
from pydantic import BaseModel
from .. import models, schemas, auth
from ..database import get_db
from ..services.auth_service import auth_service
from ..oidc import get_oidc_config, exchange_code_for_tokens, validate_id_token, revoke_token

router = APIRouter(tags=["Authentication"])

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

# --- SSO ENDPOINTS ---

class SSOCallbackRequest(BaseModel):
    code: str
    code_verifier: str
    redirect_uri: str


class SSOLogoutRequest(BaseModel):
    refresh_token: str


@router.get("/auth/sso/config")
async def sso_config():
    """Return OIDC config needed by the frontend to initiate SSO login."""
    config = get_oidc_config()
    if not config:
        raise HTTPException(status_code=404, detail="SSO not configured")
    return {
        "authorize_url": config.authorize_url,
        "client_id": config.client_id,
        "redirect_uri": config.redirect_uri,
        "scopes": config.scopes,
    }


@router.post("/auth/sso/callback")
async def sso_callback(payload: SSOCallbackRequest, db: Session = Depends(get_db)):
    """Exchange an authorization code for tokens and issue a Core JWT."""
    config = get_oidc_config()
    if not config:
        raise HTTPException(status_code=500, detail="SSO not configured")

    # 1. Exchange code for tokens
    try:
        token_response = await exchange_code_for_tokens(
            code=payload.code,
            code_verifier=payload.code_verifier,
            redirect_uri=payload.redirect_uri,
            config=config,
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    # 2. Validate ID token
    id_token = token_response.get("id_token")
    if not id_token:
        raise HTTPException(status_code=401, detail="No ID token in response")

    try:
        claims = await validate_id_token(id_token, config)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid ID token: {e}")

    # 3. Map SSO user to local user
    sub = claims.get("sub")
    email = claims.get("email")

    user = None
    if sub:
        user = db.query(models.User).filter(models.User.id == sub).first()
    if not user and email:
        user = db.query(models.User).filter(models.User.email == email).first()

    if not user:
        raise HTTPException(status_code=401, detail="No matching local user")

    if not user.is_active:
        raise HTTPException(status_code=401, detail="User account is inactive")

    # 4. Issue Core's own HS256 JWT
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_payload = {
        "sub": user.email,
        "scope": user.access_scope,
        "role": user.role,
        "id": str(user.id),
        "account_id": str(user.account_id) if user.account_id else None,
    }
    access_token = auth.create_access_token(
        data=token_payload, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": token_response.get("refresh_token"),
    }


@router.post("/auth/sso/logout")
async def sso_logout(payload: SSOLogoutRequest):
    """Revoke the SSO refresh token at Sanctum Auth."""
    config = get_oidc_config()
    if not config:
        raise HTTPException(status_code=500, detail="SSO not configured")

    await revoke_token(payload.refresh_token, config)
    return {"status": "ok"}
