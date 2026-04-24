"""Unit tests for the Governor phase-criteria gate (#2876, Gate 2).

Tests validate_ticket_transition in app.services.ticket_validation.

Gate rules:
- Empty/missing phase_criteria → no enforcement (bypass).
- phase_criteria[current] exists with all truthy values → transition allowed.
- phase_criteria[current] has any falsy value → 422 with missing_criteria list.
- Supports both flat dict {"key": bool} and nested {"items": [{"done": bool,
  "key": "..."}]} shapes.
- Reopen (requested="new") always bypasses.
- Caller is expected to gate under skip_validation; the service function
  itself just skips when phase_criteria is falsy.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services.ticket_validation import validate_ticket_transition


def _mk_db():
    db = MagicMock()
    # Fallback transitions path — needs get_ticket_transitions to return a dict.
    # We stub the governance call at module level via a minimal patch instead.
    return db


def test_empty_phase_criteria_bypasses_gate(monkeypatch):
    """Empty dict passes through — gate is inactive without criteria."""
    # Stub allowed transitions so the outer transition check also passes.
    monkeypatch.setattr(
        "app.services.ticket_validation.get_available_transitions",
        lambda *a, **k: ["proposal"],
    )
    validate_ticket_transition(
        current="recon",
        requested="proposal",
        db=_mk_db(),
        ticket_type="feature",
        phase_criteria={},
    )


def test_none_phase_criteria_bypasses_gate(monkeypatch):
    monkeypatch.setattr(
        "app.services.ticket_validation.get_available_transitions",
        lambda *a, **k: ["proposal"],
    )
    validate_ticket_transition(
        current="recon",
        requested="proposal",
        db=_mk_db(),
        ticket_type="feature",
        phase_criteria=None,
    )


def test_fully_ticked_flat_criteria_passes(monkeypatch):
    monkeypatch.setattr(
        "app.services.ticket_validation.get_available_transitions",
        lambda *a, **k: ["proposal"],
    )
    validate_ticket_transition(
        current="recon",
        requested="proposal",
        db=_mk_db(),
        ticket_type="feature",
        phase_criteria={"recon": {"read_ticket": True, "grep_code": True}},
    )


def test_unticked_flat_criteria_rejected():
    with pytest.raises(HTTPException) as exc_info:
        validate_ticket_transition(
            current="recon",
            requested="proposal",
            db=_mk_db(),
            ticket_type="feature",
            phase_criteria={"recon": {"read_ticket": True, "grep_code": False}},
        )
    assert exc_info.value.status_code == 422
    detail = exc_info.value.detail
    assert detail["error_code"] == "GOVERNOR_GATE_PHASE_CRITERIA"
    assert detail["current"] == "recon"
    assert detail["requested"] == "proposal"
    assert "grep_code" in detail["missing_criteria"]
    assert "next_action" in detail


def test_unticked_items_list_rejected():
    """Nested {"items": [{...}]} shape is also evaluated."""
    criteria = {
        "recon": {
            "items": [
                {"key": "read_ticket", "done": True},
                {"key": "grep_code", "done": False},
                {"key": "check_deps", "done": False},
            ]
        }
    }
    with pytest.raises(HTTPException) as exc_info:
        validate_ticket_transition(
            current="recon",
            requested="proposal",
            db=_mk_db(),
            ticket_type="feature",
            phase_criteria=criteria,
        )
    detail = exc_info.value.detail
    assert detail["error_code"] == "GOVERNOR_GATE_PHASE_CRITERIA"
    assert set(detail["missing_criteria"]) == {"grep_code", "check_deps"}


def test_fully_ticked_items_list_passes(monkeypatch):
    monkeypatch.setattr(
        "app.services.ticket_validation.get_available_transitions",
        lambda *a, **k: ["proposal"],
    )
    criteria = {
        "recon": {
            "items": [
                {"key": "read_ticket", "done": True},
                {"key": "grep_code", "done": True},
            ]
        }
    }
    validate_ticket_transition(
        current="recon",
        requested="proposal",
        db=_mk_db(),
        ticket_type="feature",
        phase_criteria=criteria,
    )


def test_reopen_bypasses_phase_criteria_check():
    """requested == 'new' short-circuits — gate never fires."""
    validate_ticket_transition(
        current="recon",
        requested="new",
        db=_mk_db(),
        ticket_type="feature",
        phase_criteria={"recon": {"blocker": False}},  # would normally reject
    )


def test_gate_only_checks_current_phase(monkeypatch):
    """Unticked items on a DIFFERENT phase should not block the current transition."""
    monkeypatch.setattr(
        "app.services.ticket_validation.get_available_transitions",
        lambda *a, **k: ["proposal"],
    )
    # proposal phase has unticked items, but we're leaving 'recon' — only
    # recon's criteria matter.
    criteria = {
        "recon": {"read_ticket": True},
        "proposal": {"write_plan": False},
    }
    validate_ticket_transition(
        current="recon",
        requested="proposal",
        db=_mk_db(),
        ticket_type="feature",
        phase_criteria=criteria,
    )


def test_empty_items_list_passes(monkeypatch):
    monkeypatch.setattr(
        "app.services.ticket_validation.get_available_transitions",
        lambda *a, **k: ["proposal"],
    )
    criteria = {"recon": {"items": []}}
    validate_ticket_transition(
        current="recon",
        requested="proposal",
        db=_mk_db(),
        ticket_type="feature",
        phase_criteria=criteria,
    )
