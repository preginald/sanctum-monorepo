"""
Sanctum Auth API client.

Wraps the Client Registration API on Sanctum Auth (DOC-069).
Uses synchronous httpx following the pattern from audit_client.py.
"""

import os
import logging
import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

SANCTUM_AUTH_URL = os.getenv(
    "SANCTUM_AUTH_URL", "https://auth.digitalsanctum.com.au"
)
SANCTUM_AUTH_SERVICE_TOKEN = os.getenv("SANCTUM_AUTH_SERVICE_TOKEN", "")


class SanctumAuthAPIError(Exception):
    """Raised when the Sanctum Auth API returns a non-success response."""

    def __init__(self, message: str, status_code: int = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def _ensure_token():
    """Raise 503 if the service token is not configured."""
    if not SANCTUM_AUTH_SERVICE_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="SSO service unavailable: SANCTUM_AUTH_SERVICE_TOKEN not configured",
        )


def _headers():
    """Build authorization headers for Auth API requests."""
    return {"Authorization": f"Bearer {SANCTUM_AUTH_SERVICE_TOKEN}"}


def _handle_error(response: httpx.Response):
    """Translate Auth API error responses into SanctumAuthAPIError."""
    try:
        body = response.json()
        detail = body.get("detail") or body.get("error") or response.text[:500]
    except Exception:
        detail = response.text[:500]

    if response.status_code == 429:
        raise SanctumAuthAPIError(
            "Sanctum Auth rate limit exceeded. Please wait a moment and try again.",
            status_code=429,
        )

    raise SanctumAuthAPIError(
        f"Sanctum Auth API error: {detail}",
        status_code=response.status_code,
    )


def register_client(
    name: str,
    redirect_uris: list,
    scopes: str,
    grant_types: str,
    metadata: dict,
) -> dict:
    """
    POST /api/clients -- register a new OIDC client.
    Returns the full response dict including client_secret (shown once).
    """
    _ensure_token()

    payload = {
        "name": name,
        "redirect_uris": redirect_uris,
        "scopes": scopes,
        "grant_types": grant_types,
        "metadata": metadata,
    }

    try:
        with httpx.Client(timeout=httpx.Timeout(10.0)) as client:
            response = client.post(
                f"{SANCTUM_AUTH_URL}/api/clients",
                json=payload,
                headers=_headers(),
            )
    except httpx.ConnectError as e:
        raise SanctumAuthAPIError(f"Connection to Sanctum Auth failed: {e}")
    except httpx.TimeoutException as e:
        raise SanctumAuthAPIError(f"Sanctum Auth request timed out: {e}")
    except httpx.HTTPError as e:
        raise SanctumAuthAPIError(f"HTTP error contacting Sanctum Auth: {e}")

    if response.status_code not in (200, 201):
        _handle_error(response)

    return response.json()


def rotate_client_secret(client_id: str) -> dict:
    """
    POST /api/clients/{client_id}/rotate-secret -- rotate the client secret.
    Returns dict with new client_secret.
    """
    _ensure_token()

    try:
        with httpx.Client(timeout=httpx.Timeout(10.0)) as client:
            response = client.post(
                f"{SANCTUM_AUTH_URL}/api/clients/{client_id}/rotate-secret",
                headers=_headers(),
            )
    except httpx.ConnectError as e:
        raise SanctumAuthAPIError(f"Connection to Sanctum Auth failed: {e}")
    except httpx.TimeoutException as e:
        raise SanctumAuthAPIError(f"Sanctum Auth request timed out: {e}")
    except httpx.HTTPError as e:
        raise SanctumAuthAPIError(f"HTTP error contacting Sanctum Auth: {e}")

    if response.status_code != 200:
        _handle_error(response)

    return response.json()


def delete_client(client_id: str) -> None:
    """
    DELETE /api/clients/{client_id} -- delete the OIDC client and revoke tokens.
    Returns None on success (204).
    """
    _ensure_token()

    try:
        with httpx.Client(timeout=httpx.Timeout(10.0)) as client:
            response = client.delete(
                f"{SANCTUM_AUTH_URL}/api/clients/{client_id}",
                headers=_headers(),
            )
    except httpx.ConnectError as e:
        raise SanctumAuthAPIError(f"Connection to Sanctum Auth failed: {e}")
    except httpx.TimeoutException as e:
        raise SanctumAuthAPIError(f"Sanctum Auth request timed out: {e}")
    except httpx.HTTPError as e:
        raise SanctumAuthAPIError(f"HTTP error contacting Sanctum Auth: {e}")

    if response.status_code not in (200, 204):
        _handle_error(response)


def get_client(client_id: str) -> dict:
    """
    GET /api/clients/{client_id} -- fetch client details for verification.
    Returns the client dict (no secret).
    """
    _ensure_token()

    try:
        with httpx.Client(timeout=httpx.Timeout(10.0)) as client:
            response = client.get(
                f"{SANCTUM_AUTH_URL}/api/clients/{client_id}",
                headers=_headers(),
            )
    except httpx.ConnectError as e:
        raise SanctumAuthAPIError(f"Connection to Sanctum Auth failed: {e}")
    except httpx.TimeoutException as e:
        raise SanctumAuthAPIError(f"Sanctum Auth request timed out: {e}")
    except httpx.HTTPError as e:
        raise SanctumAuthAPIError(f"HTTP error contacting Sanctum Auth: {e}")

    if response.status_code != 200:
        _handle_error(response)

    return response.json()
