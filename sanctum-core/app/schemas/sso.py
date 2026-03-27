"""Schemas for SSO client registration proxy endpoints."""

from typing import List, Optional
from .shared import SanctumBase


class SSORegisterRequest(SanctumBase):
    display_name: str
    redirect_uris: List[str]
    scopes: str = "openid profile email"
    grant_types: str = "authorization_code refresh_token"


class SSORegisterResponse(SanctumBase):
    client_id: str
    client_secret: str
    name: str
    redirect_uris: List[str]


class SSORotateResponse(SanctumBase):
    client_id: str
    client_secret: str
    rotated_at: str


class SSOStatusResponse(SanctumBase):
    has_sso: bool
    client_id: Optional[str] = None
