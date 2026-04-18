"""Test-wide fixtures for Sanctum Core.

Two fixture families coexist here:

1. Live-API fixtures (``api``, ``test_app``) used by the existing end-to-end
   suite that authenticates against the running server via ``SanctumClient``.
2. RS256/OIDC fixtures (``oidc_rs256_keys``, ``sign_rs256``) added with #2793
   for the M2M auth unit tests in ``test_auth_m2m.py``. They monkey-patch
   :func:`app.oidc.fetch_jwks` and the in-memory ``_jwks_cache`` so
   :func:`app.oidc.validate_id_token` /
   :func:`app.oidc.validate_m2m_token` resolve against an ephemeral test
   keypair without touching the network.
"""

from __future__ import annotations

import os

# Ensure DATABASE_URL / SECRET_KEY / OIDC_* are set before app.database or
# app.main is imported. ``setdefault`` is a no-op when ``.env`` (loaded below)
# or the surrounding shell already supplies a value.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("OIDC_ISSUER", "https://auth.example.test")
os.environ.setdefault("OIDC_CLIENT_ID", "sanctum-core")
os.environ.setdefault("OIDC_CLIENT_SECRET", "test-secret")
os.environ.setdefault("OIDC_REDIRECT_URI", "http://localhost/callback")

import time
from dataclasses import dataclass

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from dotenv import load_dotenv
from jose import jwk, jwt

from client import SanctumClient  # From your tests/client.py

# Load real ``.env`` for live-API fixtures (does not override anything already
# in the environment, so the setdefault block above wins for unit tests).
load_dotenv("sanctum-core/.env")


# ---------------------------------------------------------------------------
# Live-API fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def api():
    """Your root API client (Hits the live/dev server)"""
    base = os.getenv("API_BASE", "http://localhost:8000")
    email = os.getenv("SANCTUM_EMAIL", "peter@digitalsanctum.com.au")

    password = os.getenv("SANCTUM_PASSWORD")
    totp_secret = os.getenv("SANCTUM_TOTP_SECRET")

    client = SanctumClient(base)
    client.authenticate(email, password, totp_secret)
    return client


@pytest.fixture
def test_app():
    """Internal FastAPI TestClient (Boots the app in-memory)"""
    from app.main import app
    from fastapi.testclient import TestClient
    return TestClient(app)


# ---------------------------------------------------------------------------
# RS256 / OIDC fixtures (#2793)
# ---------------------------------------------------------------------------


@dataclass
class _RS256Fixture:
    private_pem: bytes
    jwks: dict
    kid: str
    issuer: str
    audience: str  # Core's own client_id — used by user-token tests


@pytest.fixture
def oidc_rs256_keys(monkeypatch) -> _RS256Fixture:
    """Ephemeral RSA keypair + JWKS monkey-patched into app.oidc.

    Yields the fixture object so individual tests can sign tokens with the
    correct ``kid``. The keypair is regenerated per-test to keep failures
    fully isolated.
    """
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public_pem = key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    kid = "test-key-1"
    jwk_public = jwk.construct(public_pem, "RS256").to_dict()
    jwk_public["kid"] = kid
    jwk_public["use"] = "sig"
    jwk_public["alg"] = "RS256"
    jwks = {"keys": [jwk_public]}

    from app import oidc

    async def _fake_fetch_jwks(config):
        return jwks

    monkeypatch.setattr(oidc, "fetch_jwks", _fake_fetch_jwks)
    # Pre-warm the cache too so any path that skips fetch still works.
    monkeypatch.setattr(oidc, "_jwks_cache", jwks)
    monkeypatch.setattr(oidc, "_jwks_cache_time", time.time())

    return _RS256Fixture(
        private_pem=private_pem,
        jwks=jwks,
        kid=kid,
        issuer=os.environ["OIDC_ISSUER"],
        audience=os.environ["OIDC_CLIENT_ID"],
    )


def sign_rs256(claims: dict, fixture: _RS256Fixture) -> str:
    """Sign ``claims`` with the fixture keypair as an RS256 JWT."""
    return jwt.encode(
        claims,
        fixture.private_pem.decode(),
        algorithm="RS256",
        headers={"kid": fixture.kid},
    )
