"""
SSO client registration proxy endpoints.

Proxies OIDC client management requests to Sanctum Auth's Client Registration API.
All endpoints require operator-level authentication (not client role).
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from .. import models, schemas, auth
from ..database import get_db
from ..services.sanctum_auth_client import (
    register_client,
    rotate_client_secret,
    delete_client,
    SanctumAuthAPIError,
)
from ..services.uuid_resolver import get_or_404 as _uuid_get_or_404

logger = logging.getLogger(__name__)

router = APIRouter(tags=["SSO"])


def _get_account_or_404(account_id: str, db: Session) -> models.Account:
    """Load an account by UUID or prefix, or raise 404."""
    return _uuid_get_or_404(db, models.Account, account_id, deleted_filter=False)


def _require_operator(current_user: models.User):
    """Reject client-role users from SSO management."""
    if current_user.role == "client":
        raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/accounts/{account_id}/sso/register", response_model=schemas.SSORegisterResponse)
def sso_register(
    account_id: str,
    body: schemas.SSORegisterRequest,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """Register a new OIDC client for this account via Sanctum Auth."""
    _require_operator(current_user)
    account = _get_account_or_404(account_id, db)

    if account.oauth_client_id:
        raise HTTPException(
            status_code=409,
            detail="This account already has an SSO client registered. Use rotate-secret or delete first.",
        )

    # Build a unique name using account name + UUID prefix
    client_name = f"{body.display_name} ({str(account.id)[:8]})"
    metadata = {"tenant_id": str(account.id), "provisioned_by": "core"}

    try:
        result = register_client(
            name=client_name,
            redirect_uris=body.redirect_uris,
            scopes=body.scopes,
            grant_types=body.grant_types,
            metadata=metadata,
        )
    except SanctumAuthAPIError as e:
        logger.error("SSO registration failed for account %s: %s", account_id, e.message)
        status = e.status_code or 502
        raise HTTPException(status_code=status, detail=e.message)

    # Persist the client_id on the account
    account.oauth_client_id = result.get("client_id")
    db.commit()
    db.refresh(account)

    return schemas.SSORegisterResponse(
        client_id=result.get("client_id"),
        client_secret=result.get("client_secret"),
        name=result.get("name", client_name),
        redirect_uris=result.get("redirect_uris", body.redirect_uris),
    )


@router.post("/accounts/{account_id}/sso/rotate-secret", response_model=schemas.SSORotateResponse)
def sso_rotate_secret(
    account_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """Rotate the client secret for this account's OIDC client."""
    _require_operator(current_user)
    account = _get_account_or_404(account_id, db)

    if not account.oauth_client_id:
        raise HTTPException(status_code=404, detail="No SSO client registered for this account")

    try:
        result = rotate_client_secret(account.oauth_client_id)
    except SanctumAuthAPIError as e:
        logger.error("SSO secret rotation failed for account %s: %s", account_id, e.message)
        status = e.status_code or 502
        raise HTTPException(status_code=status, detail=e.message)

    return schemas.SSORotateResponse(
        client_id=account.oauth_client_id,
        client_secret=result.get("client_secret"),
        rotated_at=result.get("rotated_at", ""),
    )


@router.delete("/accounts/{account_id}/sso")
def sso_delete(
    account_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete the OIDC client for this account and clear the stored client_id."""
    _require_operator(current_user)
    account = _get_account_or_404(account_id, db)

    if not account.oauth_client_id:
        raise HTTPException(status_code=404, detail="No SSO client registered for this account")

    try:
        delete_client(account.oauth_client_id)
    except SanctumAuthAPIError as e:
        logger.error("SSO deletion failed for account %s: %s", account_id, e.message)
        status = e.status_code or 502
        raise HTTPException(status_code=status, detail=e.message)

    account.oauth_client_id = None
    db.commit()

    return {"status": "deleted"}
