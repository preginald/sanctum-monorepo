"""Unit tests for the Governor Mirror gate (#2876, Gate 3).

Tests three concerns:

1. ``Comment.mirror`` column defaults to False at the SQLAlchemy model layer
   and round-trips through the ``CommentCreate`` / ``CommentResponse`` schemas.
2. The ``resolved -> closed`` gate logic in tickets.py ``update_ticket``
   (reproduced here for isolation, matching the pattern in
   ``test_billable_item_gate.py``).
3. ``skip_validation=True`` bypasses the gate, matching the existing
   break-glass override on adjacent validators.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.schemas.knowledge import CommentCreate, CommentResponse


# ---------------------------------------------------------------------------
# Schema round-trip
# ---------------------------------------------------------------------------


def test_comment_create_mirror_defaults_false():
    c = CommentCreate(body="hello", ticket_id=1)
    assert c.mirror is False


def test_comment_create_accepts_mirror_true():
    c = CommentCreate(body="mirror assessment", ticket_id=1, mirror=True)
    assert c.mirror is True


def test_comment_response_carries_mirror():
    payload = {
        "id": uuid4(),
        "author_name": "tester",
        "body": "b",
        "visibility": "internal",
        "created_at": "2026-04-24T00:00:00+00:00",
        "mirror": True,
    }
    r = CommentResponse(**payload)
    assert r.mirror is True


def test_comment_response_mirror_defaults_false_when_absent():
    payload = {
        "id": uuid4(),
        "author_name": "tester",
        "body": "b",
        "visibility": "internal",
        "created_at": "2026-04-24T00:00:00+00:00",
    }
    r = CommentResponse(**payload)
    assert r.mirror is False


# ---------------------------------------------------------------------------
# Gate 3 logic (reproduced from tickets.py for isolated testing)
# ---------------------------------------------------------------------------


def check_mirror_gate(
    *,
    skip_validation: bool,
    update_status: str | None,
    current_status: str,
    has_mirror_comment: bool,
):
    """Reproduce the Mirror gate logic from tickets.py update_ticket.

    Raises HTTPException(422) when the gate blocks; returns None when it
    passes (including when bypassed via skip_validation).
    """
    update_data = {}
    if update_status is not None:
        update_data['status'] = update_status

    if (
        not skip_validation
        and update_data.get('status') == 'closed'
        and current_status == 'resolved'
    ):
        if not has_mirror_comment:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": "Cannot close — Mirror comment required.",
                    "error_code": "GOVERNOR_GATE_MIRROR",
                    "current": current_status,
                    "requested": "closed",
                    "next_action": "Post a comment with mirror=true assessing process gaps before closing. See DOC-073.",
                    "reference": "DOC-073",
                    "help": "DOC-073 describes the Mirror phase — a short self-review of the delivery process posted as a comment with mirror=true.",
                },
            )


class TestMirrorGateBlocks:
    def test_close_without_mirror_comment_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            check_mirror_gate(
                skip_validation=False,
                update_status='closed',
                current_status='resolved',
                has_mirror_comment=False,
            )
        assert exc_info.value.status_code == 422
        detail = exc_info.value.detail
        assert detail["error_code"] == "GOVERNOR_GATE_MIRROR"
        assert detail["current"] == "resolved"
        assert detail["requested"] == "closed"
        assert detail["reference"] == "DOC-073"
        assert "Mirror" in detail["detail"]


class TestMirrorGatePasses:
    def test_close_with_mirror_comment_allowed(self):
        check_mirror_gate(
            skip_validation=False,
            update_status='closed',
            current_status='resolved',
            has_mirror_comment=True,
        )

    def test_skip_validation_bypasses_gate(self):
        check_mirror_gate(
            skip_validation=True,
            update_status='closed',
            current_status='resolved',
            has_mirror_comment=False,
        )

    def test_non_close_transition_unaffected(self):
        # resolved → resolved (no-op) or other targets — gate should not fire
        check_mirror_gate(
            skip_validation=False,
            update_status='documented',
            current_status='resolved',
            has_mirror_comment=False,
        )

    def test_close_from_non_resolved_unaffected(self):
        # Gate only fires on the specific resolved -> closed path; other
        # sources (e.g. an admin jump-close from open) would be blocked by
        # the transition allow-list anyway, not this gate.
        check_mirror_gate(
            skip_validation=False,
            update_status='closed',
            current_status='open',
            has_mirror_comment=False,
        )
