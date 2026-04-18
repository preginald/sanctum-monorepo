"""
PHASE 63: The Keymaster — API Token Management
Personal Access Tokens for CLI, scripts, and integrations.
"""

import logging
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional
import secrets

from pydantic import BaseModel, field_validator

from app.database import get_db
from app import models
from app.auth import get_current_active_user, pwd_context

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api-tokens", tags=["API Tokens"])


# ---------------------------------------------------------------------------
# Request schema (#2806)
# ---------------------------------------------------------------------------


class CreateApiTokenRequest(BaseModel):
    """Request body for minting a Personal Access Token.

    All fields are optional at schema level; the handler enforces `name` is
    present via either body or query-param (back-compat path). `scopes`, when
    provided, must be a non-empty list of strings — enforced by pydantic
    (results in 422). Scope enforcement at consumption time is delegated to
    :func:`app.auth.require_scope` on protected routes; this endpoint is
    forward-compatible with new scopes added to other services.
    """

    name: Optional[str] = None
    expires_in_days: Optional[int] = None
    scopes: Optional[list[str]] = None

    @field_validator("scopes")
    @classmethod
    def _validate_scopes(cls, v):
        if v is None:
            return v
        if not isinstance(v, list) or len(v) == 0:
            raise ValueError("scopes must be a non-empty list of strings")
        for item in v:
            if not isinstance(item, str):
                raise ValueError("scopes must contain only strings")
        return v


# ---------------------------------------------------------------------------
# Shared helpers (#2806)
# ---------------------------------------------------------------------------


def _mint_pat(
    db: Session,
    user: models.User,
    name: str,
    expires_in_days: Optional[int],
    scopes: Optional[list[str]],
):
    """Create + persist an ApiToken for ``user`` and return ``(row, raw_token)``.

    Shared by the self-mint endpoint (``POST /api-tokens``) and the admin-mint
    endpoint (``POST /admin/users/{user_id}/api-tokens``). Keeping mint logic
    here — rather than a new shared module — avoids an extra file for a single
    helper; admin.py imports it instead.
    """
    raw_token = f"sntm_{secrets.token_hex(20)}"
    prefix = raw_token[:12]
    token_hash = pwd_context.hash(raw_token)

    expires_at = None
    if expires_in_days:
        from datetime import timedelta
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    kwargs = dict(
        user_id=user.id,
        name=name,
        token_hash=token_hash,
        token_prefix=prefix,
        expires_at=expires_at,
    )
    if scopes is not None:
        kwargs["scopes"] = scopes

    api_token = models.ApiToken(**kwargs)
    db.add(api_token)
    db.commit()
    db.refresh(api_token)
    return api_token, raw_token


def _emit_token_audit(
    *,
    endpoint: str,
    principal_id,
    target_user_id,
    acted_on_behalf_of_user_id,
    token_prefix: str,
    scopes,
) -> None:
    """Emit a structured audit line for a PAT mint event.

    Mirrors the shape used by ``app.routers.artefacts._emit_principal_audit``
    (forward-compatible shim for a future central audit log). On self-mint,
    ``acted_on_behalf_of_user_id`` is passed as the sentinel ``'-'`` so the
    field is always emitted and log-grep friendly.

    Note: ``scopes`` is rendered space-separated. Scope strings today do not
    contain spaces (convention: ``namespace:verb``), so the format is
    unambiguous. If that convention ever changes, switch to comma-separated.
    """
    if scopes is None:
        scopes_str = "*"
    elif isinstance(scopes, list):
        scopes_str = " ".join(scopes) if scopes else "-"
    else:
        scopes_str = str(scopes)

    log.info(
        "api_tokens.audit endpoint=%s principal_id=%s target_user_id=%s "
        "acted_on_behalf_of_user_id=%s token_prefix=%s scopes=%s",
        endpoint,
        principal_id,
        target_user_id,
        acted_on_behalf_of_user_id,
        token_prefix,
        scopes_str,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("")
def create_api_token(
    name: Optional[str] = Query(None),
    expires_in_days: Optional[int] = Query(None),
    body: Optional[CreateApiTokenRequest] = Body(None),
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Create a Personal Access Token.
    Returns the plain token ONCE — store it securely.

    Accepts either legacy query params (``?name=...&expires_in_days=...``) or
    a JSON body. ``scopes`` is body-only. Precedence: body field wins when
    both query and body supply the same field (#2806 observation #1).

    - name: Label for the token ("CLI Scripts", "CI/CD")
    - expires_in_days: Optional expiry (null = never expires)
    - scopes: Optional list of scopes (defaults to ``["*"]`` via model)
    """
    # Precedence rule: body wins when present, else fall back to query param.
    effective_name = body.name if (body and body.name) else name
    effective_expires = (
        body.expires_in_days if (body and body.expires_in_days is not None) else expires_in_days
    )
    effective_scopes = body.scopes if body else None

    if not effective_name:
        raise HTTPException(status_code=400, detail="name is required")

    api_token, raw_token = _mint_pat(
        db, current_user, effective_name, effective_expires, effective_scopes
    )

    _emit_token_audit(
        endpoint="api_tokens.self_mint",
        principal_id=current_user.id,
        target_user_id=current_user.id,
        acted_on_behalf_of_user_id="-",
        token_prefix=api_token.token_prefix,
        scopes=api_token.scopes,
    )

    return {
        "id": str(api_token.id),
        "name": api_token.name,
        "token": raw_token,  # ONLY time the full token is returned
        "prefix": api_token.token_prefix,
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
