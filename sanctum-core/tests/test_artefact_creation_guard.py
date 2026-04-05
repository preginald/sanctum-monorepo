"""Unit tests for the artefact creation guard (#1480).

Tests the session_handover authorship restriction from
app/services/artefact_validation.py:
- Scribe + session_handover raises 422 with correct fields
- Scribe + runbook passes
- Scribe + None passes
- Architect UUID + session_handover passes
- Operator UUID + session_handover passes
- Arbitrary human UUID + session_handover passes
- 422 detail contains error_code, blocked_account, reference keys
"""

from uuid import UUID

import pytest
from fastapi import HTTPException

from app.services.artefact_validation import (
    SCRIBE_USER_ID,
    validate_session_handover_authorship,
)

# Well-known service account UUIDs
ARCHITECT_USER_ID = UUID("a1b2c3d4-0001-4000-8000-000000000001")
OPERATOR_USER_ID = UUID("a1b2c3d4-0003-4000-8000-000000000003")
SCRIBE_UUID = UUID(SCRIBE_USER_ID)
HUMAN_UUID = UUID("deadbeef-dead-4ead-8ead-beefdeadbeef")


class TestScribeBlocked:
    """The Scribe must be blocked from creating session_handover artefacts."""

    def test_scribe_session_handover_raises_422(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_session_handover_authorship("session_handover", SCRIBE_UUID)
        assert exc_info.value.status_code == 422

    def test_422_detail_contains_required_keys(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_session_handover_authorship("session_handover", SCRIBE_UUID)
        detail = exc_info.value.detail
        assert detail["error_code"] == "handover_authorship_restricted"
        assert detail["blocked_account"] == SCRIBE_USER_ID
        assert detail["reference"] == "SOP-038"
        assert detail["category"] == "session_handover"
        assert "help" in detail

    def test_422_detail_message(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_session_handover_authorship("session_handover", SCRIBE_UUID)
        assert "The Scribe" in exc_info.value.detail["detail"]
        assert "session context" in exc_info.value.detail["detail"]


class TestScribeAllowedCategories:
    """The Scribe should be allowed for non-session_handover categories."""

    def test_scribe_runbook_passes(self):
        # Should not raise
        validate_session_handover_authorship("runbook", SCRIBE_UUID)

    def test_scribe_none_category_passes(self):
        # Should not raise
        validate_session_handover_authorship(None, SCRIBE_UUID)


class TestNonScribeAllowed:
    """Non-Scribe accounts should be allowed to create session_handover artefacts."""

    def test_architect_session_handover_passes(self):
        validate_session_handover_authorship("session_handover", ARCHITECT_USER_ID)

    def test_operator_session_handover_passes(self):
        validate_session_handover_authorship("session_handover", OPERATOR_USER_ID)

    def test_human_session_handover_passes(self):
        validate_session_handover_authorship("session_handover", HUMAN_UUID)
