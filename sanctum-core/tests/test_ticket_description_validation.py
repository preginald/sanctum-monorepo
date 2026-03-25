"""Unit tests for validate_ticket_description in ticket_validation.py."""

import pytest
from fastapi import HTTPException

from app.services.ticket_validation import validate_ticket_description, TEMPLATE_REQUIREMENTS


# --- Helpers ---

def _make_description(headings: list[str]) -> str:
    """Build a minimal valid description from a list of ## headings."""
    return "\n\n".join(f"{h}\n\nContent for {h}." for h in headings)


# --- Valid descriptions accepted for all 10 types ---

@pytest.mark.parametrize("ticket_type", list(TEMPLATE_REQUIREMENTS.keys()))
def test_valid_description_accepted(ticket_type):
    """A description containing all required headings should pass validation."""
    headings = TEMPLATE_REQUIREMENTS[ticket_type]["headings"]
    description = _make_description(headings)
    # Should not raise
    validate_ticket_description(ticket_type, description)


@pytest.mark.parametrize("ticket_type", list(TEMPLATE_REQUIREMENTS.keys()))
def test_valid_description_with_extra_headings(ticket_type):
    """Extra headings beyond the required ones should not cause a failure."""
    headings = TEMPLATE_REQUIREMENTS[ticket_type]["headings"] + ["## Extra Section"]
    description = _make_description(headings)
    validate_ticket_description(ticket_type, description)


# --- Missing required heading returns 422 ---

@pytest.mark.parametrize("ticket_type", list(TEMPLATE_REQUIREMENTS.keys()))
def test_missing_heading_raises_422(ticket_type):
    """Omitting the first required heading should raise HTTPException 422."""
    headings = TEMPLATE_REQUIREMENTS[ticket_type]["headings"]
    # Drop the first required heading
    incomplete = headings[1:]
    description = _make_description(incomplete)
    with pytest.raises(HTTPException) as exc_info:
        validate_ticket_description(ticket_type, description)
    assert exc_info.value.status_code == 422
    detail = exc_info.value.detail
    assert headings[0] in detail["missing_sections"]
    assert detail["template_article"] == TEMPLATE_REQUIREMENTS[ticket_type]["article"]


@pytest.mark.parametrize("ticket_type", list(TEMPLATE_REQUIREMENTS.keys()))
def test_missing_all_headings_raises_422(ticket_type):
    """A description with no headings at all should raise 422 with all missing."""
    description = "Just some text without any headings."
    with pytest.raises(HTTPException) as exc_info:
        validate_ticket_description(ticket_type, description)
    assert exc_info.value.status_code == 422
    detail = exc_info.value.detail
    expected_missing = TEMPLATE_REQUIREMENTS[ticket_type]["headings"]
    assert detail["missing_sections"] == expected_missing


# --- Empty/None description passes ---

@pytest.mark.parametrize("description", [None, ""])
def test_empty_description_passes(description):
    """None or empty descriptions should pass validation (no template check)."""
    validate_ticket_description("feature", description)


def test_whitespace_only_description_is_truthy():
    """Whitespace-only string is truthy so it enters validation. For a type
    with no template (unknown), it passes. For a templated type, it would fail."""
    # Unknown type -- no template, so whitespace passes
    validate_ticket_description("unknown_type", "   ")
    # Templated type -- whitespace has no headings, so it fails
    with pytest.raises(HTTPException):
        validate_ticket_description("feature", "   ")


# --- Unknown ticket type passes ---

def test_unknown_ticket_type_passes():
    """An unrecognised ticket type should pass validation (no template defined)."""
    validate_ticket_description("unknown_type", "Random description without headings")


def test_unknown_ticket_type_with_headings_passes():
    """An unrecognised type with headings should also pass."""
    validate_ticket_description("totally_new_type", "## Something\n\nContent.")


# --- Regression: all 4 original types still work ---

class TestOriginalTypeRegression:
    """Verify the 4 original templated types (feature, bug, task, refactor) still validate correctly."""

    def test_feature_valid(self):
        desc = _make_description(["## Objective", "## Requirements", "## Acceptance Criteria"])
        validate_ticket_description("feature", desc)

    def test_feature_invalid(self):
        desc = _make_description(["## Objective"])
        with pytest.raises(HTTPException) as exc_info:
            validate_ticket_description("feature", desc)
        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["template_article"] == "DOC-016"

    def test_bug_valid(self):
        desc = _make_description(["## Bug", "## Root Cause", "## Acceptance Criteria"])
        validate_ticket_description("bug", desc)

    def test_bug_invalid(self):
        desc = _make_description(["## Bug"])
        with pytest.raises(HTTPException) as exc_info:
            validate_ticket_description("bug", desc)
        assert exc_info.value.detail["template_article"] == "DOC-013"

    def test_task_valid(self):
        desc = _make_description(["## Objective", "## Requirements", "## Acceptance Criteria"])
        validate_ticket_description("task", desc)

    def test_refactor_valid(self):
        desc = _make_description(["## Objective", "## Motivation", "## Acceptance Criteria"])
        validate_ticket_description("refactor", desc)


# --- New type-specific tests ---

class TestNewTemplateTypes:
    """Verify each of the 6 newly templated types."""

    def test_hotfix_valid(self):
        desc = _make_description(["## Bug", "## Fix", "## Acceptance Criteria"])
        validate_ticket_description("hotfix", desc)

    def test_hotfix_missing_fix(self):
        desc = _make_description(["## Bug", "## Acceptance Criteria"])
        with pytest.raises(HTTPException) as exc_info:
            validate_ticket_description("hotfix", desc)
        assert "## Fix" in exc_info.value.detail["missing_sections"]
        assert exc_info.value.detail["template_article"] == "DOC-057"

    def test_support_valid(self):
        desc = _make_description(["## Issue", "## Investigation", "## Response", "## Acceptance Criteria"])
        validate_ticket_description("support", desc)

    def test_support_missing_investigation(self):
        desc = _make_description(["## Issue", "## Response", "## Acceptance Criteria"])
        with pytest.raises(HTTPException) as exc_info:
            validate_ticket_description("support", desc)
        assert "## Investigation" in exc_info.value.detail["missing_sections"]
        assert exc_info.value.detail["template_article"] == "DOC-058"

    def test_alert_valid(self):
        desc = _make_description(["## Alert", "## Triage", "## Action", "## Acceptance Criteria"])
        validate_ticket_description("alert", desc)

    def test_alert_missing_triage(self):
        desc = _make_description(["## Alert", "## Action", "## Acceptance Criteria"])
        with pytest.raises(HTTPException) as exc_info:
            validate_ticket_description("alert", desc)
        assert "## Triage" in exc_info.value.detail["missing_sections"]
        assert exc_info.value.detail["template_article"] == "DOC-059"

    def test_access_valid(self):
        desc = _make_description(["## Request", "## Justification", "## Acceptance Criteria"])
        validate_ticket_description("access", desc)

    def test_access_missing_justification(self):
        desc = _make_description(["## Request", "## Acceptance Criteria"])
        with pytest.raises(HTTPException) as exc_info:
            validate_ticket_description("access", desc)
        assert "## Justification" in exc_info.value.detail["missing_sections"]
        assert exc_info.value.detail["template_article"] == "DOC-060"

    def test_maintenance_valid(self):
        desc = _make_description(["## Objective", "## Procedure", "## Rollback", "## Acceptance Criteria"])
        validate_ticket_description("maintenance", desc)

    def test_maintenance_missing_rollback(self):
        desc = _make_description(["## Objective", "## Procedure", "## Acceptance Criteria"])
        with pytest.raises(HTTPException) as exc_info:
            validate_ticket_description("maintenance", desc)
        assert "## Rollback" in exc_info.value.detail["missing_sections"]
        assert exc_info.value.detail["template_article"] == "DOC-061"

    def test_test_valid(self):
        desc = _make_description(["## Objective", "## Test Plan", "## Expected Results", "## Acceptance Criteria"])
        validate_ticket_description("test", desc)

    def test_test_missing_test_plan(self):
        desc = _make_description(["## Objective", "## Expected Results", "## Acceptance Criteria"])
        with pytest.raises(HTTPException) as exc_info:
            validate_ticket_description("test", desc)
        assert "## Test Plan" in exc_info.value.detail["missing_sections"]
        assert exc_info.value.detail["template_article"] == "DOC-062"


# --- TEMPLATE_REQUIREMENTS coverage check ---

def test_all_10_types_have_templates():
    """Verify all 10 ticket types have template definitions."""
    expected = {"feature", "bug", "task", "refactor", "hotfix", "support", "alert", "access", "maintenance", "test"}
    assert set(TEMPLATE_REQUIREMENTS.keys()) == expected


def test_all_templates_have_acceptance_criteria():
    """Every template should require ## Acceptance Criteria."""
    for ticket_type, req in TEMPLATE_REQUIREMENTS.items():
        assert "## Acceptance Criteria" in req["headings"], f"{ticket_type} missing AC heading"
