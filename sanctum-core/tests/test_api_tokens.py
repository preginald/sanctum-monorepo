"""Unit tests for PAT mint endpoints (#2806).

Covers the self-mint path (``POST /api-tokens``, refactored to dual-accept
query + body with optional ``scopes``) and the new admin-mint endpoint
(``POST /admin/users/{user_id}/api-tokens``). The underlying PAT auth
regression — ``sntm_`` tokens resolve to a ``User`` — is asserted in
``test_auth_m2m.py::test_pat_token_still_resolves_to_user`` and is
intentionally untouched here.

Tests call the router handlers directly with stubbed ``Session`` /
``User`` objects rather than spinning up a full FastAPI TestClient, to
match the style of ``test_auth_m2m.py`` and keep fixture plumbing to a
minimum (per proposal observation #6).
"""

from __future__ import annotations

import logging
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError


# ---------------------------------------------------------------------------
# Helpers — in-memory ApiToken capture
# ---------------------------------------------------------------------------


def _fake_db_capturing():
    """Stub Session that captures the added ApiToken and assigns defaults."""
    db = MagicMock()
    added = []

    def _add(obj):
        # Simulate server defaults so the handler's ``api_token.created_at`` /
        # ``api_token.id`` accesses don't explode.
        from datetime import datetime, timezone
        if getattr(obj, "id", None) is None:
            obj.id = uuid4()
        if getattr(obj, "created_at", None) is None:
            obj.created_at = datetime.now(timezone.utc)
        # Model-level Python default for scopes kicks in only when SQLAlchemy
        # flushes; mimic it here so tests see the effective value.
        if getattr(obj, "scopes", None) is None:
            obj.scopes = ["*"]
        added.append(obj)

    db.add.side_effect = _add
    db.commit.return_value = None
    db.refresh.return_value = None
    return db, added


def _stub_user(role: str = "tech") -> MagicMock:
    from app import models

    user = MagicMock(spec=models.User)
    user.id = uuid4()
    user.role = role
    user.is_active = True
    return user


# ---------------------------------------------------------------------------
# CreateApiTokenRequest — pydantic validation (422 per observation #2)
# ---------------------------------------------------------------------------


class TestCreateApiTokenRequestValidation:
    def test_accepts_none_scopes(self):
        from app.routers.api_tokens import CreateApiTokenRequest

        req = CreateApiTokenRequest(name="x")
        assert req.scopes is None

    def test_accepts_non_empty_string_list(self):
        from app.routers.api_tokens import CreateApiTokenRequest

        req = CreateApiTokenRequest(name="x", scopes=["artefacts:read"])
        assert req.scopes == ["artefacts:read"]

    def test_rejects_empty_scope_list(self):
        from app.routers.api_tokens import CreateApiTokenRequest

        with pytest.raises(ValidationError):
            CreateApiTokenRequest(name="x", scopes=[])

    def test_rejects_non_string_scope_element(self):
        from app.routers.api_tokens import CreateApiTokenRequest

        with pytest.raises(ValidationError):
            CreateApiTokenRequest(name="x", scopes=[123])


# ---------------------------------------------------------------------------
# Self-mint — POST /api-tokens
# ---------------------------------------------------------------------------


class TestSelfMint:
    def test_default_scopes_is_wildcard(self):
        from app.routers.api_tokens import create_api_token

        db, added = _fake_db_capturing()
        user = _stub_user()

        resp = create_api_token(
            name="CLI Scripts",
            expires_in_days=None,
            body=None,
            current_user=user,
            db=db,
        )

        assert len(added) == 1
        assert added[0].user_id == user.id
        assert added[0].scopes == ["*"]
        assert resp["token"].startswith("sntm_")
        assert resp["prefix"] == resp["token"][:12]
        assert resp["name"] == "CLI Scripts"

    def test_explicit_scopes_persisted(self):
        from app.routers.api_tokens import CreateApiTokenRequest, create_api_token

        db, added = _fake_db_capturing()
        user = _stub_user()

        resp = create_api_token(
            name=None,
            expires_in_days=None,
            body=CreateApiTokenRequest(
                name="CI deploy key",
                scopes=["artefacts:read", "artefacts:write"],
            ),
            current_user=user,
            db=db,
        )

        assert added[0].scopes == ["artefacts:read", "artefacts:write"]
        assert added[0].name == "CI deploy key"
        assert resp["name"] == "CI deploy key"

    def test_legacy_query_param_compat(self):
        """Profile.jsx calls POST /api-tokens?name=...&expires_in_days=...
        — must continue to work byte-identically when no body is sent."""
        from app.routers.api_tokens import create_api_token

        db, added = _fake_db_capturing()
        user = _stub_user()

        resp = create_api_token(
            name="legacy call",
            expires_in_days=90,
            body=None,
            current_user=user,
            db=db,
        )

        assert added[0].name == "legacy call"
        assert added[0].expires_at is not None
        assert added[0].scopes == ["*"]  # no scopes passed => model default
        assert resp["name"] == "legacy call"

    def test_body_wins_over_query_when_both_present(self):
        """Precedence rule pinned per observation #1 — body.name beats query name."""
        from app.routers.api_tokens import CreateApiTokenRequest, create_api_token

        db, added = _fake_db_capturing()
        user = _stub_user()

        resp = create_api_token(
            name="from-query",
            expires_in_days=10,
            body=CreateApiTokenRequest(name="from-body", expires_in_days=30),
            current_user=user,
            db=db,
        )

        assert added[0].name == "from-body"
        # expires_in_days=30 → future timestamp ~30 days out, strictly larger
        # than the 10-day query-param value we'd otherwise have used.
        from datetime import datetime, timezone, timedelta
        assert added[0].expires_at is not None
        eleven_days_out = datetime.now(timezone.utc) + timedelta(days=11)
        assert added[0].expires_at > eleven_days_out
        assert resp["name"] == "from-body"

    def test_raises_400_when_no_name(self):
        from app.routers.api_tokens import create_api_token

        db, _ = _fake_db_capturing()
        user = _stub_user()

        with pytest.raises(HTTPException) as exc:
            create_api_token(
                name=None, expires_in_days=None, body=None, current_user=user, db=db
            )
        assert exc.value.status_code == 400

    def test_audit_log_self_mint_has_dash_on_behalf(self, caplog):
        """Self-mint emits ``acted_on_behalf_of_user_id=-`` sentinel."""
        from app.routers import api_tokens as api_tokens_mod

        db, _ = _fake_db_capturing()
        user = _stub_user()

        with caplog.at_level(logging.INFO, logger=api_tokens_mod.log.name):
            api_tokens_mod.create_api_token(
                name="audited",
                expires_in_days=None,
                body=None,
                current_user=user,
                db=db,
            )

        msgs = " ".join(r.getMessage() for r in caplog.records)
        assert "endpoint=api_tokens.self_mint" in msgs
        assert "acted_on_behalf_of_user_id=-" in msgs
        assert f"target_user_id={user.id}" in msgs
        assert "scopes=*" in msgs


# ---------------------------------------------------------------------------
# Admin-mint — POST /admin/users/{user_id}/api-tokens
# ---------------------------------------------------------------------------


class TestAdminMint:
    def _patch_get_or_404(self, monkeypatch, *, user=None, raise_404=False):
        """Replace ``admin.get_or_404`` with a stub that returns ``user`` or raises."""
        from app.routers import admin as admin_mod

        def _fake(db, model, user_id, deleted_filter=False):
            if raise_404:
                raise HTTPException(status_code=404, detail="User not found")
            return user

        monkeypatch.setattr(admin_mod, "get_or_404", _fake)

    def test_admin_mint_success(self, monkeypatch):
        from app.routers.admin import admin_create_api_token
        from app.routers.api_tokens import CreateApiTokenRequest

        admin = _stub_user(role="admin")
        target = _stub_user(role="tech")
        db, added = _fake_db_capturing()

        self._patch_get_or_404(monkeypatch, user=target)

        resp = admin_create_api_token(
            user_id=str(target.id),
            body=CreateApiTokenRequest(
                name="agent key for bob",
                expires_in_days=30,
                scopes=["artefacts:read"],
            ),
            current_user=admin,
            db=db,
        )

        assert len(added) == 1
        assert added[0].user_id == target.id
        assert added[0].scopes == ["artefacts:read"]
        assert resp["token"].startswith("sntm_")
        assert resp["minted_for_user_id"] == str(target.id)
        assert "secure channel" in resp["warning"].lower()

    def test_admin_mint_requires_name(self, monkeypatch):
        from app.routers.admin import admin_create_api_token
        from app.routers.api_tokens import CreateApiTokenRequest

        admin = _stub_user(role="admin")
        target = _stub_user()
        db, _ = _fake_db_capturing()
        self._patch_get_or_404(monkeypatch, user=target)

        with pytest.raises(HTTPException) as exc:
            admin_create_api_token(
                user_id=str(target.id),
                body=CreateApiTokenRequest(name=None, scopes=["a:b"]),
                current_user=admin,
                db=db,
            )
        assert exc.value.status_code == 400

    def test_admin_mint_forbidden_for_non_admin(self):
        """``get_current_admin`` raises 403 for role != admin — simulated by
        invoking the dependency directly."""
        from app.routers.admin import get_current_admin

        tech_user = _stub_user(role="tech")
        with pytest.raises(HTTPException) as exc:
            get_current_admin(current_user=tech_user)
        assert exc.value.status_code == 403

    def test_admin_mint_404_for_unknown_target(self, monkeypatch):
        from app.routers.admin import admin_create_api_token
        from app.routers.api_tokens import CreateApiTokenRequest

        admin = _stub_user(role="admin")
        db, _ = _fake_db_capturing()
        self._patch_get_or_404(monkeypatch, raise_404=True)

        with pytest.raises(HTTPException) as exc:
            admin_create_api_token(
                user_id="00000000-0000-0000-0000-000000000000",
                body=CreateApiTokenRequest(name="x"),
                current_user=admin,
                db=db,
            )
        assert exc.value.status_code == 404

    def test_admin_mint_rejects_empty_scopes_at_schema(self):
        """Empty scopes list rejected by pydantic → 422 path (observation #2)."""
        from app.routers.api_tokens import CreateApiTokenRequest

        with pytest.raises(ValidationError):
            CreateApiTokenRequest(name="x", scopes=[])

    def test_admin_mint_rejects_non_string_scope_element_at_schema(self):
        from app.routers.api_tokens import CreateApiTokenRequest

        with pytest.raises(ValidationError):
            CreateApiTokenRequest(name="x", scopes=[123])

    def test_admin_mint_audit_log_fields(self, monkeypatch, caplog):
        from app.routers import api_tokens as api_tokens_mod
        from app.routers.admin import admin_create_api_token
        from app.routers.api_tokens import CreateApiTokenRequest

        admin = _stub_user(role="admin")
        target = _stub_user(role="tech")
        db, _ = _fake_db_capturing()
        self._patch_get_or_404(monkeypatch, user=target)

        with caplog.at_level(logging.INFO, logger=api_tokens_mod.log.name):
            admin_create_api_token(
                user_id=str(target.id),
                body=CreateApiTokenRequest(
                    name="agent",
                    scopes=["artefacts:read", "artefacts:write"],
                ),
                current_user=admin,
                db=db,
            )

        msgs = " ".join(r.getMessage() for r in caplog.records)
        assert "endpoint=admin.users.mint_api_token" in msgs
        assert f"principal_id={admin.id}" in msgs
        assert f"target_user_id={target.id}" in msgs
        assert f"acted_on_behalf_of_user_id={target.id}" in msgs
        assert "scopes=artefacts:read artefacts:write" in msgs
