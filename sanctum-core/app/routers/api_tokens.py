"""
PHASE 63: The Keymaster — API Token Management
Personal Access Tokens for CLI, scripts, and integrations.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional
import secrets

from app.database import get_db
from app import models
from app.auth import get_current_active_user, pwd_context

router = APIRouter(prefix="/api-tokens", tags=["API Tokens"])


@router.post("")
def create_api_token(
    name: str,
    expires_in_days: Optional[int] = None,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a Personal Access Token.
    Returns the plain token ONCE — store it securely.

    - name: Label for the token ("CLI Scripts", "CI/CD")
    - expires_in_days: Optional expiry (null = never expires)
    """
    # Generate token: sntm_ + 40 hex chars
    raw_token = f"sntm_{secrets.token_hex(20)}"
    prefix = raw_token[:12]
    token_hash = pwd_context.hash(raw_token)

    expires_at = None
    if expires_in_days:
        from datetime import timedelta
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    api_token = models.ApiToken(
        user_id=current_user.id,
        name=name,
        token_hash=token_hash,
        token_prefix=prefix,
        expires_at=expires_at
    )

    db.add(api_token)
    db.commit()
    db.refresh(api_token)

    return {
        "id": str(api_token.id),
        "name": api_token.name,
        "token": raw_token,  # ONLY time the full token is returned
        "prefix": prefix,
        "expires_at": api_token.expires_at.isoformat() if api_token.expires_at else None,
        "created_at": api_token.created_at.isoformat(),
        "warning": "Save this token now — it cannot be retrieved again."
    }


@router.get("")
def list_api_tokens(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all tokens for the current user (prefix + metadata only)."""
    tokens = db.query(models.ApiToken).filter(
        models.ApiToken.user_id == current_user.id
    ).order_by(models.ApiToken.created_at.desc()).all()

    return [
        {
            "id": str(t.id),
            "name": t.name,
            "prefix": t.token_prefix,
            "scopes": t.scopes,
            "is_active": t.is_active,
            "expires_at": t.expires_at.isoformat() if t.expires_at else None,
            "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None,
            "created_at": t.created_at.isoformat(),
            "is_expired": t.expires_at < datetime.now(timezone.utc) if t.expires_at else False
        }
        for t in tokens
    ]


@router.delete("/{token_id}")
def revoke_api_token(
    token_id: str,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Revoke (deactivate) an API token."""
    token = db.query(models.ApiToken).filter(
        models.ApiToken.id == token_id,
        models.ApiToken.user_id == current_user.id
    ).first()

    if not token:
        raise HTTPException(status_code=404, detail="Token not found")

    token.is_active = False
    db.commit()

    return {"status": "revoked", "prefix": token.token_prefix}
