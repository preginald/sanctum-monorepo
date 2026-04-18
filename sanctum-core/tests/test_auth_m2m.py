"""Unit tests for M2M client-credentials authentication in Core (#2793).

Covers:
- Valid M2M token -> ServicePrincipal (happy path)
- Expired M2M token -> 401
- Wrong issuer -> 401
- Valid RS256 but no grant_type -> 401 (audience-relaxation guard)
- User RS256 JWT -> User lookup (regression)
- sntm_ PAT -> User (regression)
- HS256 legacy JWT -> User (regression)
- get_current_active_user raises 403 for ServicePrincipal
- require_scope gates allow / deny on scope membership
- require_scope no-ops for User principals
- Audit log emits principal_type for both principal kinds

All tests avoid the network by monkey-patching app.oidc.fetch_jwks
via the ``oidc_rs256_keys`` fixture.
"""

from __future__ import annotations

import logging
import time
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from jose import jwt

from conftest import sign_rs256  # tests/ is on sys.path via pytest.ini


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _m2m_claims(fixture, *, sub="test-client", scope="artefacts:read", exp_delta=300, grant_type="client_credentials", iss=None, client_name=None):
    now = int(time.time())
    claims = {
        "sub": sub,
        "aud": sub,
        "iss": iss if iss is not None else fixture.issuer,
        "iat": now,
        "exp": now + exp_delta,
        "jti": str(uuid4()),
        "scope": scope,
    }
    if grant_type is not None:
        claims["grant_type"] = grant_type
    if client_name is not None:
        claims["client_name"] = client_name
    return claims


def _user_claims(fixture, *, sub=None, email="user@example.com"):
    now = int(time.time())
    return {
        "sub": sub or str(uuid4()),
        "aud": fixture.audience,
        "iss": fixture.issuer,
        "iat": now,
        "exp": now + 300,
        "email": email,
        "jti": str(uuid4()),
    }


def _fake_db_returning(user):
    """Build a stub Session where ``query(User).filter(...).first()`` yields ``user``."""
    db = MagicMock()
    chain = db.query.return_value.filter.return_value
    chain.first.return_value = user
    return db


# ---------------------------------------------------------------------------
# M2M token -> ServicePrincipal
# ---------------------------------------------------------------------------


class TestM2MTokenAccepted:
    @pytest.mark.asyncio
    async def test_valid_m2m_token_builds_service_principal(self, oidc_rs256_keys):
        from app import auth
        from app.principals import ServicePrincipal

        token = sign_rs256(
            _m2m_claims(
                oidc_rs256_keys,
                sub="sanctum-mock-tests",
                scope="artefacts:read ticket:read",
                client_name="Sanctum Mock Tests",
            ),
            oidc_rs256_keys,
        )
        db = _fake_db_returning(None)

        principal = await auth._resolve_principal(token, db)

        assert isinstance(principal, ServicePrincipal)
        assert principal.client_id == "sanctum-mock-tests"
        assert principal.client_name == "Sanctum Mock Tests"
        assert principal.scopes == ["artefacts:read", "ticket:read"]
        assert principal.expires_at is not None

    @pytest.mark.asyncio
    async def test_m2m_client_name_defaults_when_absent(self, oidc_rs256_keys):
        from app import auth
        from app.principals import ServicePrincipal

        token = sign_rs256(
            _m2m_claims(oidc_rs256_keys, sub="svc-acct-xyz123", client_name=None),
            oidc_rs256_keys,
        )
        principal = await auth._resolve_principal(token, _fake_db_returning(None))

        assert isinstance(principal, ServicePrincipal)
        assert principal.client_name is None
        assert principal.display_name == "service:svc-acct"


# ---------------------------------------------------------------------------
# Rejection paths
# ---------------------------------------------------------------------------


class TestM2MTokenRejected:
    @pytest.mark.asyncio
    async def test_expired_m2m_token_rejected(self, oidc_rs256_keys):
        from app import auth

        token = sign_rs256(
            _m2m_claims(oidc_rs256_keys, exp_delta=-60), oidc_rs256_keys
        )
        with pytest.raises(HTTPException) as exc:
            await auth._resolve_principal(token, _fake_db_returning(None))
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_wrong_issuer_rejected(self, oidc_rs256_keys):
        from app import auth

        token = sign_rs256(
            _m2m_claims(oidc_rs256_keys, iss="https://evil.example"),
            oidc_rs256_keys,
        )
        with pytest.raises(HTTPException) as exc:
            await auth._resolve_principal(token, _fake_db_returning(None))
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_grant_type_rejected(self, oidc_rs256_keys):
        """Foreign-audience token lacking grant_type must not slip through
        the relaxed-audience M2M path. Token decodes fine as RS256 but has
        ``aud != sanctum-core`` and no ``grant_type``."""
        from app import auth

        claims = _m2m_claims(oidc_rs256_keys, grant_type=None)
        token = sign_rs256(claims, oidc_rs256_keys)

        with pytest.raises(HTTPException) as exc:
            await auth._resolve_principal(token, _fake_db_returning(None))
        assert exc.value.status_code == 401


# ---------------------------------------------------------------------------
# Regression — user tokens still resolve to User
# ---------------------------------------------------------------------------


class TestUserTokenRegression:
    @pytest.mark.asyncio
    async def test_user_rs256_still_resolves_to_user(self, oidc_rs256_keys):
        from app import auth, models

        user = MagicMock(spec=models.User)
        user.is_active = True
        user.id = uuid4()

        token = sign_rs256(_user_claims(oidc_rs256_keys, sub=str(user.id)), oidc_rs256_keys)
        db = _fake_db_returning(user)

        principal = await auth._resolve_principal(token, db)

        assert principal is user

    @pytest.mark.asyncio
    async def test_pat_token_still_resolves_to_user(self):
        from app import auth, models

        # Build a stub PAT + user
        user = MagicMock(spec=models.User)
        user.is_active = True
        token_row = MagicMock()
        token_row.user = user
        token_row.token_hash = "$2b$12$hashvalue"  # will be bypassed via verify mock
        token_row.expires_at = None

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = token_row

        import app.auth as auth_mod

        auth_mod.pwd_context = MagicMock(verify=lambda t, h: True)
        try:
            result = await auth._resolve_principal("sntm_abc123xyz000", db)
        finally:
            # restore real context (fixture-less cleanup)
            from passlib.context import CryptContext

            auth_mod.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

        assert result is user

    @pytest.mark.asyncio
    async def test_hs256_legacy_token_still_resolves_to_user(self, monkeypatch):
        from app import auth, models

        user = MagicMock(spec=models.User)
        user.is_active = True

        token = jwt.encode(
            {"sub": "legacy@example.com", "exp": int(time.time()) + 300},
            auth.SECRET_KEY,
            algorithm="HS256",
        )
        db = _fake_db_returning(user)

        result = await auth._resolve_principal(token, db)

        assert result is user


# ---------------------------------------------------------------------------
# get_current_active_user behaviour change (403 for service)
# ---------------------------------------------------------------------------


class TestGetCurrentActiveUser:
    @pytest.mark.asyncio
    async def test_raises_403_for_service_principal(self):
        from app import auth
        from app.principals import ServicePrincipal

        sp = ServicePrincipal(client_id="svc", client_name=None, scopes=["*"])

        with pytest.raises(HTTPException) as exc:
            await auth.get_current_active_user(principal=sp)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_passes_through_active_user(self):
        from app import auth, models

        user = MagicMock(spec=models.User)
        user.is_active = True

        result = await auth.get_current_active_user(principal=user)
        assert result is user


# ---------------------------------------------------------------------------
# require_scope
# ---------------------------------------------------------------------------


class TestRequireScope:
    @pytest.mark.asyncio
    async def test_allows_when_scope_present(self):
        from app import auth
        from app.principals import ServicePrincipal

        sp = ServicePrincipal(client_id="svc", client_name=None, scopes=["artefacts:read"])
        dep = auth.require_scope("artefacts:read")
        result = await dep(principal=sp)
        assert result is sp

    @pytest.mark.asyncio
    async def test_denies_when_scope_missing(self):
        from app import auth
        from app.principals import ServicePrincipal

        sp = ServicePrincipal(client_id="svc", client_name=None, scopes=["other:scope"])
        dep = auth.require_scope("artefacts:read")
        with pytest.raises(HTTPException) as exc:
            await dep(principal=sp)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_wildcard_scope_grants_everything(self):
        from app import auth
        from app.principals import ServicePrincipal

        sp = ServicePrincipal(client_id="svc", client_name=None, scopes=["*"])
        dep = auth.require_scope("whatever:scope")
        result = await dep(principal=sp)
        assert result is sp

    @pytest.mark.asyncio
    async def test_user_principal_bypasses_scope_check(self):
        from app import auth, models

        user = MagicMock(spec=models.User)
        dep = auth.require_scope("artefacts:read")
        result = await dep(principal=user)
        assert result is user


# ---------------------------------------------------------------------------
# Audit-log principal_type tagging
# ---------------------------------------------------------------------------


class TestAuditPrincipalType:
    def test_emit_principal_audit_tags_service(self, caplog):
        from app.principals import ServicePrincipal
        from app.routers import artefacts as artefacts_mod

        sp = ServicePrincipal(
            client_id="sanctum-mock-tests",
            client_name="Sanctum Mock Tests",
            scopes=["artefacts:read"],
        )
        with caplog.at_level(logging.INFO, logger=artefacts_mod.log.name):
            artefacts_mod._emit_principal_audit(sp, endpoint="artefacts.list")

        record_msgs = " ".join(r.getMessage() for r in caplog.records)
        assert "principal_type=service" in record_msgs
        assert "client_id=sanctum-mock-tests" in record_msgs

    def test_emit_principal_audit_tags_user(self, caplog):
        from app import models
        from app.routers import artefacts as artefacts_mod

        user = MagicMock(spec=models.User)
        user.id = "00000000-0000-0000-0000-000000000123"

        with caplog.at_level(logging.INFO, logger=artefacts_mod.log.name):
            artefacts_mod._emit_principal_audit(user, endpoint="artefacts.list")

        record_msgs = " ".join(r.getMessage() for r in caplog.records)
        assert "principal_type=user" in record_msgs
