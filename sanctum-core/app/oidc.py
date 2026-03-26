"""
OIDC integration for Sanctum Auth SSO.

Handles JWKS fetching, ID token validation, and authorization code exchange.
See DOC-064: Sanctum Auth Client Integration Guide.
"""

import os
import time
import httpx
from dataclasses import dataclass
from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv()


@dataclass
class OIDCConfig:
    issuer: str
    client_id: str
    client_secret: str
    redirect_uri: str
    scopes: str

    @property
    def authorize_url(self) -> str:
        return f"{self.issuer}/oauth/authorize"

    @property
    def token_url(self) -> str:
        return f"{self.issuer}/oauth/token"

    @property
    def jwks_url(self) -> str:
        return f"{self.issuer}/.well-known/jwks.json"

    @property
    def revoke_url(self) -> str:
        return f"{self.issuer}/oauth/revoke"


def get_oidc_config() -> OIDCConfig | None:
    issuer = os.getenv("OIDC_ISSUER")
    client_id = os.getenv("OIDC_CLIENT_ID")
    client_secret = os.getenv("OIDC_CLIENT_SECRET")
    redirect_uri = os.getenv("OIDC_REDIRECT_URI")
    scopes = os.getenv("OIDC_SCOPES", "openid profile email")

    if not all([issuer, client_id, client_secret, redirect_uri]):
        return None

    return OIDCConfig(
        issuer=issuer,
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scopes=scopes,
    )


# --- JWKS Cache ---
_jwks_cache: dict | None = None
_jwks_cache_time: float = 0
JWKS_CACHE_TTL = 3600  # 1 hour


async def fetch_jwks(config: OIDCConfig) -> dict:
    global _jwks_cache, _jwks_cache_time

    now = time.time()
    if _jwks_cache and (now - _jwks_cache_time) < JWKS_CACHE_TTL:
        return _jwks_cache

    async with httpx.AsyncClient() as client:
        resp = await client.get(config.jwks_url, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cache_time = now
        return _jwks_cache


def _find_signing_key(jwks: dict, kid: str) -> dict:
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    raise ValueError(f"No matching key found for kid={kid}")


async def validate_id_token(token: str, config: OIDCConfig) -> dict:
    """Validate an ID token (or access token) signed RS256 by Sanctum Auth."""
    headers = jwt.get_unverified_headers(token)
    kid = headers.get("kid")
    if not kid:
        raise JWTError("Token missing kid header")

    jwks = await fetch_jwks(config)
    signing_key = _find_signing_key(jwks, kid)

    claims = jwt.decode(
        token,
        signing_key,
        algorithms=["RS256"],
        audience=config.client_id,
        issuer=config.issuer,
    )
    return claims


async def exchange_code_for_tokens(
    code: str, code_verifier: str, redirect_uri: str, config: OIDCConfig
) -> dict:
    """Exchange an authorization code for tokens at Sanctum Auth's token endpoint."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            config.token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "code_verifier": code_verifier,
            },
            auth=(config.client_id, config.client_secret),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )

    if resp.status_code != 200:
        error_body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        raise ValueError(
            f"Token exchange failed: {error_body.get('error', resp.status_code)} "
            f"- {error_body.get('error_description', resp.text)}"
        )

    return resp.json()


async def revoke_token(refresh_token: str, config: OIDCConfig) -> None:
    """Revoke a refresh token at Sanctum Auth's revocation endpoint."""
    async with httpx.AsyncClient() as client:
        await client.post(
            config.revoke_url,
            data={
                "token": refresh_token,
                "token_type_hint": "refresh_token",
            },
            auth=(config.client_id, config.client_secret),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
