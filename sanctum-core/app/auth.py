from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from . import models
from .principals import (
    Principal,
    ServicePrincipal,
    principal_audit_label,
    principal_type_of,
    service_principal_from_claims,
)
from datetime import datetime, timedelta, timezone  # Added timezone
from typing import Callable, Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

load_dotenv()

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 720

# Hashing Context (retained for API token verification)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta # Updated
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15) # Updated


    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

http_bearer = HTTPBearer()


async def _resolve_principal(token: str, db: Session) -> Principal:
    """Resolve a Bearer token to a ``User`` or a ``ServicePrincipal``.

    Principal-type dispatch lives here so ``get_current_principal`` and the
    legacy ``get_current_user`` share a single decode path. Kept separate from
    FastAPI dependency plumbing to make it easy to unit-test without spinning
    up an app.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # API Token path (Personal Access Tokens) — untouched (#2793 non-negotiable).
    if token.startswith("sntm_"):
        prefix = token[:12]
        api_token = db.query(models.ApiToken).filter(
            models.ApiToken.token_prefix == prefix,
            models.ApiToken.is_active == True
        ).first()
        if not api_token:
            raise credentials_exception
        if not pwd_context.verify(token, api_token.token_hash):
            raise credentials_exception
        if api_token.expires_at and api_token.expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        api_token.last_used_at = datetime.now(timezone.utc)
        db.commit()
        return api_token.user

    # JWT path — detect algorithm from token header
    try:
        headers = jwt.get_unverified_headers(token)
        alg = headers.get("alg", "HS256")
    except JWTError:
        raise credentials_exception

    if alg == "RS256":
        # SSO token from Sanctum Auth — could be either a user ID token or an
        # M2M client-credentials access token. Peek at unverified claims FIRST
        # and branch on grant_type (per the verdict's craft note): exception
        # dispatch on jose.JWTError is not reliable enough.
        from .oidc import (
            get_oidc_config,
            peek_unverified_claims,
            validate_id_token,
            validate_m2m_token,
        )

        config = get_oidc_config()
        if not config:
            raise credentials_exception

        try:
            unverified = peek_unverified_claims(token)
        except Exception:
            raise credentials_exception

        if unverified.get("grant_type") == "client_credentials":
            # M2M path — verify with audience relaxed (DOC-064 §3b).
            try:
                claims = await validate_m2m_token(token, config)
            except Exception:
                raise credentials_exception
            return service_principal_from_claims(claims)

        # User token path — audience enforced strictly (unchanged).
        try:
            claims = await validate_id_token(token, config)
        except Exception:
            raise credentials_exception

        sub = claims.get("sub")
        user = None
        if sub:
            user = db.query(models.User).filter(models.User.id == sub).first()
        if not user:
            email = claims.get("email")
            if email:
                user = db.query(models.User).filter(models.User.email == email).first()
        if user is None:
            raise credentials_exception
        return user

    # HS256 path (existing Core JWT) — untouched (#2793 non-negotiable).
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> Principal:
    """Resolve the Bearer token to a ``User`` or ``ServicePrincipal``.

    Existing handlers use ``get_current_active_user`` which continues to
    return ``User`` (raising 403 for service principals), so the return-type
    widening here is strictly additive for opt-in callers.
    """
    return await _resolve_principal(credentials.credentials, db)


async def get_current_principal(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> Principal:
    """Opt-in dependency for routes that accept either a user or an M2M service
    principal. Identical resolution to :func:`get_current_user`; exists as a
    sibling so the intent is explicit at the handler site."""
    return await _resolve_principal(credentials.credentials, db)


async def get_current_active_user(
    principal: Principal = Depends(get_current_principal),
) -> models.User:
    """Legacy user-only dependency.

    Service principals get a clean 403 instead of leaking a ``ServicePrincipal``
    into handlers that expect ``User.id`` / ``User.email``.
    """
    if isinstance(principal, ServicePrincipal):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Endpoint requires a user principal",
        )
    if not principal.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return principal


def require_user_principal(
    principal: Principal = Depends(get_current_principal),
) -> models.User:
    """Narrow a ``Principal`` to ``User`` or raise 403."""
    if isinstance(principal, ServicePrincipal):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Endpoint requires a user principal",
        )
    return principal


def require_service_principal(
    principal: Principal = Depends(get_current_principal),
) -> ServicePrincipal:
    """Narrow a ``Principal`` to ``ServicePrincipal`` or raise 403."""
    if not isinstance(principal, ServicePrincipal):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Endpoint requires a service principal",
        )
    return principal


def require_scope(*required: str) -> Callable:
    """Return a FastAPI dependency that enforces required OAuth2 scopes on the
    caller's ``ServicePrincipal``.

    Per the approved proposal, user principals bypass this check — users rely
    on role-based auth elsewhere and Sanctum Auth does not (yet) issue scope
    claims on user access tokens. The ``*`` wildcard grants everything.
    """
    async def _dep(principal: Principal = Depends(get_current_principal)) -> Principal:
        if not isinstance(principal, ServicePrincipal):
            return principal  # users bypass scope gating (see docstring)
        granted = set(principal.scopes)
        if "*" in granted:
            return principal
        missing = [scope for scope in required if scope not in granted]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required scope(s): {', '.join(missing)}",
            )
        return principal

    return _dep


__all__ = [
    "Principal",
    "ServicePrincipal",
    "create_access_token",
    "get_current_active_user",
    "get_current_principal",
    "get_current_user",
    "principal_audit_label",
    "principal_type_of",
    "require_scope",
    "require_service_principal",
    "require_user_principal",
]
