"""Unit tests for ticket status extensions and phase_criteria (#2875).

Covers:
- TicketStatus StrEnum membership and values
- Pydantic schema round-trips for phase_criteria
- Governance flow transitions (documented inserted; qa zombie purged)
- Cascade TERMINAL/ACTIVE set membership
"""
from uuid import uuid4

import pytest

from app.constants.ticket_status import TicketStatus, TICKET_STATUS_VALUES
from app.services import cascade, governance
from app.schemas.operations import TicketCreate, TicketUpdate


# ---------------------------------------------------------------------------
# TicketStatus StrEnum
# ---------------------------------------------------------------------------


def test_ticket_status_expected_members_exist():
    """All canonical statuses must be present on the StrEnum."""
    expected = {
        "NEW", "OPEN", "RECON", "PROPOSAL", "IMPLEMENTATION",
        "VERIFICATION", "REVIEW", "DOCUMENTED", "PENDING", "RESOLVED",
        "CLOSED",
    }
    assert {m.name for m in TicketStatus} == expected


def test_ticket_status_values_frozen_set():
    """TICKET_STATUS_VALUES is a frozenset of lowercase string values."""
    assert isinstance(TICKET_STATUS_VALUES, frozenset)
    assert "documented" in TICKET_STATUS_VALUES
    assert "qa" not in TICKET_STATUS_VALUES
    # Legacy read-tolerance until #3028
    assert "closed" in TICKET_STATUS_VALUES


def test_ticket_status_str_values():
    """StrEnum members serialise to their lowercase values."""
    assert TicketStatus.DOCUMENTED == "documented"
    assert TicketStatus.DOCUMENTED.value == "documented"
    assert str(TicketStatus.DOCUMENTED.value) == "documented"


# ---------------------------------------------------------------------------
# Pydantic schema round-trips
# ---------------------------------------------------------------------------


def _base_create_payload(**overrides):
    payload = {
        "account_id": uuid4(),
        "subject": "Test ticket",
        "ticket_type": "task",
    }
    payload.update(overrides)
    return payload


def test_ticket_create_accepts_none_phase_criteria():
    """phase_criteria defaults to None when omitted."""
    model = TicketCreate(**_base_create_payload())
    assert model.phase_criteria is None


def test_ticket_create_accepts_empty_dict():
    model = TicketCreate(**_base_create_payload(phase_criteria={}))
    assert model.phase_criteria == {}


def test_ticket_create_accepts_populated_dict():
    criteria = {
        "recon": {"status_gate": "recon", "items": []},
        "proposal": {"status_gate": "proposal", "items": []},
    }
    model = TicketCreate(**_base_create_payload(phase_criteria=criteria))
    assert model.phase_criteria == criteria


def test_ticket_create_rejects_non_dict_phase_criteria():
    with pytest.raises(Exception):
        TicketCreate(**_base_create_payload(phase_criteria=["not", "a", "dict"]))


def test_ticket_update_partial_preserves_other_fields():
    """phase_criteria on TicketUpdate is optional and independent."""
    update = TicketUpdate(phase_criteria={"recon": {"items": []}})
    assert update.phase_criteria == {"recon": {"items": []}}
    assert update.status is None
    assert update.priority is None


def test_ticket_update_round_trip_json():
    update = TicketUpdate(phase_criteria={"foo": "bar"})
    dumped = update.model_dump(exclude_none=True)
    assert dumped == {"phase_criteria": {"foo": "bar"}}


# ---------------------------------------------------------------------------
# Governance flow transitions
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("ticket_type", ["feature", "bug", "task", "refactor"])
def test_templated_flow_contains_documented_between_review_and_resolved(ticket_type):
    forward = governance.TICKET_STATUS_FLOWS[ticket_type]["forward"]
    assert "documented" in forward
    assert forward.index("documented") == forward.index("review") + 1
    assert forward.index("resolved") == forward.index("documented") + 1


@pytest.mark.parametrize("ticket_type", ["feature", "bug", "task", "refactor"])
def test_templated_flow_review_forward_now_documented(ticket_type):
    """review -> documented is now the forward step for templated types."""
    transitions = governance.get_transitions_for_type(ticket_type, "review")
    assert "documented" in transitions


@pytest.mark.parametrize("ticket_type", ["feature", "bug", "task", "refactor"])
def test_templated_flow_documented_forward_resolved(ticket_type):
    """documented -> resolved is the forward step."""
    transitions = governance.get_transitions_for_type(ticket_type, "documented")
    assert "resolved" in transitions


@pytest.mark.parametrize("ticket_type", ["feature", "bug", "task", "refactor"])
def test_templated_flow_documented_backward_to_review(ticket_type):
    """documented can step back to review for corrections."""
    backward = governance.TICKET_STATUS_FLOWS[ticket_type]["backward"]
    assert "documented" in backward
    assert "review" in backward["documented"]


@pytest.mark.parametrize("ticket_type", ["support", "access", "alert", "hotfix", "maintenance", "test"])
def test_simple_and_short_flows_do_not_include_documented(ticket_type):
    """documented is a templated-delivery phase; simple/short flows must not include it."""
    forward = governance.TICKET_STATUS_FLOWS[ticket_type]["forward"]
    assert "documented" not in forward


def test_fallback_transitions_purge_qa_zombie():
    assert "qa" not in governance.FALLBACK_TICKET_TRANSITIONS
    # Also: no existing entry may point to qa
    for targets in governance.FALLBACK_TICKET_TRANSITIONS.values():
        assert "qa" not in targets


def test_fallback_transitions_contain_documented():
    assert "documented" in governance.FALLBACK_TICKET_TRANSITIONS
    assert "resolved" in governance.FALLBACK_TICKET_TRANSITIONS["documented"]
    # review can step forward to documented
    assert "documented" in governance.FALLBACK_TICKET_TRANSITIONS["review"]


# ---------------------------------------------------------------------------
# Cascade set membership
# ---------------------------------------------------------------------------


def test_cascade_active_set_contains_documented():
    assert "documented" in cascade.ACTIVE_TICKET_STATUSES


def test_cascade_terminal_set_unchanged_keeps_closed():
    """closed remains in TERMINAL until #3028 closes the deprecation window."""
    assert cascade.TERMINAL_TICKET_STATUSES == {"resolved", "closed"}


def test_cascade_sets_are_disjoint():
    assert cascade.ACTIVE_TICKET_STATUSES.isdisjoint(cascade.TERMINAL_TICKET_STATUSES)
