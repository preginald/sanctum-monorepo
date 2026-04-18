"""Test-wide fixtures for Sanctum Core.

The ``oidc_rs256_keys`` fixture generates an ephemeral RSA keypair and wires
both :func:`app.oidc.fetch_jwks` (async JWKS fetch) and the in-memory
``_jwks_cache`` so :func:`app.oidc.validate_id_token` /
:func:`app.oidc.validate_m2m_token` resolve against the test keypair without
touching the network.

Used by ``test_auth_m2m.py`` (#2793) and any future auth unit test that needs
to craft RS256 tokens inline.
"""

from __future__ import annotations

import os

# Ensure DATABASE_URL / SECRET_KEY are set before app.database evaluates module
# scope. Matches the invocation pattern used in CI.
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
from jose import jwk, jwt


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
