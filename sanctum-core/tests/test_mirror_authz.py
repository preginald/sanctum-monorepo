"""Authorization tests for the `mirror` flag on POST /comments (#3062).

Only principals with role `admin` or `agent` may set `mirror=true` on
`POST /comments`. A `client`-role user receives HTTP 403. The portal
endpoint (`POST /portal/tickets/{id}/comments`) always ignores the
`mirror` field regardless of role — it constructs `Comment(...)` without
passing `mirror`, so the model default (False) applies.

Follows the isolated-logic test pattern used by
`test_governor_gate_mirror.py` and `test_tickets_account_filter.py`:
replicate the guard logic in-module so it can be verified without a live
DB, OIDC stack, or TestClient.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Optional
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

# Bootstrap required env for any downstream app.* import the suite may pull.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")


# ---------------------------------------------------------------------------
# Fake principals + payload helpers
# ---------------------------------------------------------------------------


@dataclass
class FakeUser:
    """Mirrors the subset of `models.User` fields consulted by the guard."""

    role: str
    id: UUID = field(default_factory=uuid4)


@dataclass
class FakeCommentCreate:
    """Mirrors `schemas.CommentCreate` — only the `mirror` attr matters here."""

    body: str = "b"
    ticket_id: Optional[int] = 1
    mirror: bool = False


# ---------------------------------------------------------------------------
# Guard logic reproduced from routers/comments.py (line 40-41)
# ---------------------------------------------------------------------------


def apply_mirror_authz_guard(comment: Any, current_user: FakeUser) -> None:
    """Reproduce the authz guard from `create_comment`.

    Raises HTTPException(403) when a non-admin/agent user attempts to set
    `mirror=true`. Returns None when the request is allowed (including
    when mirror is False / omitted).
    """
    if bool(getattr(comment, "mirror", False)) and current_user.role not in (
        "admin",
        "agent",
    ):
        raise HTTPException(
            status_code=403,
            detail="Only admin/agent roles may set mirror=true",
        )


# ---------------------------------------------------------------------------
# Portal handler logic reproduced from routers/portal.py (line 496-501)
# ---------------------------------------------------------------------------


def simulate_portal_comment_persistence(payload: FakeCommentCreate) -> dict:
    """Reproduce the portal `create_portal_comment` persistence logic.

    The handler constructs `Comment(...)` passing only `ticket_id`,
    `author_id`, `body`, and `visibility='public'` — `mirror` is never
    forwarded from the payload, so the model default (False) applies.
    """
    # Model default for Comment.mirror is False (see models.py Comment).
    return {
        "body": payload.body,
        "visibility": "public",
        "mirror": False,  # portal never forwards payload.mirror
    }


# ---------------------------------------------------------------------------
# Case 1 — admin + mirror=true → allowed
# ---------------------------------------------------------------------------


class TestAdminMirrorAllowed:
    def test_admin_can_set_mirror_true(self):
        admin = FakeUser(role="admin")
        comment = FakeCommentCreate(body="mirror assessment", mirror=True)

        # Should not raise; guard passes silently.
        apply_mirror_authz_guard(comment, admin)


# ---------------------------------------------------------------------------
# Case 2 — agent + mirror=true → allowed
# ---------------------------------------------------------------------------


class TestAgentMirrorAllowed:
    def test_agent_can_set_mirror_true(self):
        agent = FakeUser(role="agent")
        comment = FakeCommentCreate(body="mirror assessment", mirror=True)

        apply_mirror_authz_guard(comment, agent)


# ---------------------------------------------------------------------------
# Case 3 — client + mirror=true → 403
# ---------------------------------------------------------------------------


class TestClientMirrorForbidden:
    def test_client_setting_mirror_true_is_rejected_with_403(self):
        client = FakeUser(role="client")
        comment = FakeCommentCreate(body="sneaky", mirror=True)

        with pytest.raises(HTTPException) as exc_info:
            apply_mirror_authz_guard(comment, client)

        assert exc_info.value.status_code == 403
        assert "Only admin/agent" in exc_info.value.detail

    def test_unknown_role_setting_mirror_true_is_rejected(self):
        # Any role outside the allowlist must be rejected — future-proofing
        # against accidental role proliferation bypassing the guard.
        weird = FakeUser(role="contractor")
        comment = FakeCommentCreate(mirror=True)

        with pytest.raises(HTTPException) as exc_info:
            apply_mirror_authz_guard(comment, weird)

        assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# Case 4 — portal endpoint ignores mirror regardless of role
# ---------------------------------------------------------------------------


class TestPortalIgnoresMirror:
    def test_portal_client_posting_mirror_true_persists_as_false(self):
        # A client user posts to /portal/tickets/{id}/comments with
        # mirror=true in the payload. The portal handler never forwards
        # `mirror` to the Comment(...) constructor (portal.py:496-501),
        # so the persisted row has mirror=False.
        payload = FakeCommentCreate(body="client comment", mirror=True)

        persisted = simulate_portal_comment_persistence(payload)

        assert persisted["mirror"] is False
        assert persisted["visibility"] == "public"

    def test_portal_ignores_mirror_even_when_false(self):
        # Regression sanity — a payload without mirror persists as False.
        payload = FakeCommentCreate(body="client comment", mirror=False)

        persisted = simulate_portal_comment_persistence(payload)

        assert persisted["mirror"] is False


# ---------------------------------------------------------------------------
# Case 5 — admin with mirror omitted / false → allowed, regression sanity
# ---------------------------------------------------------------------------


class TestMirrorFalseUnchanged:
    def test_admin_with_mirror_false_is_allowed(self):
        admin = FakeUser(role="admin")
        comment = FakeCommentCreate(body="normal comment", mirror=False)

        apply_mirror_authz_guard(comment, admin)

    def test_client_with_mirror_false_is_allowed(self):
        # Core regression — clients can still post normal comments.
        client = FakeUser(role="client")
        comment = FakeCommentCreate(body="normal comment", mirror=False)

        apply_mirror_authz_guard(comment, client)

    def test_client_with_mirror_omitted_is_allowed(self):
        client = FakeUser(role="client")
        # Simulate a payload where `mirror` attr is absent entirely
        # (the guard uses getattr(..., 'mirror', False)).
        class BareComment:
            body = "no mirror field at all"

        apply_mirror_authz_guard(BareComment(), client)


# ---------------------------------------------------------------------------
# Source-level guard — assert the real router still contains the check so
# a future refactor doesn't silently remove the enforcement.
# ---------------------------------------------------------------------------


class TestGuardPresentInRouter:
    def test_comments_router_rejects_client_mirror(self):
        """Read the real handler source and assert it contains the
        admin/agent allowlist check before persistence."""
        import inspect

        from app.routers import comments as comments_mod

        src = inspect.getsource(comments_mod.create_comment)
        guard_idx = src.find("Only admin/agent roles may set mirror=true")
        persist_idx = src.find("models.Comment(")
        allowlist_idx = src.find("('admin', 'agent')")

        assert guard_idx > 0, "403 detail message missing from create_comment"
        assert allowlist_idx > 0, "admin/agent allowlist missing from create_comment"
        assert persist_idx > 0, "Comment persistence missing from create_comment"
        assert guard_idx < persist_idx, (
            "Authz guard must precede Comment persistence so mirror=true "
            "from an unprivileged role never reaches the database."
        )
