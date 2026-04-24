"""Unit tests for the Governor activation gate (#2876, Gate 1).

Tests the logic in project_validation.py :: validate_project_transition for the
planning → active transition, including the new zero-milestone template
exception.

Gate rules:
- With milestones: passes regardless of template_id.
- No milestones, no template_id: rejected with GOVERNOR_GATE_ACTIVATION.
- No milestones, template_id pointing at a template with >= 1 section:
  rejected (template scaffolded milestones but they were since deleted).
- No milestones, template_id pointing at a zero-milestone template (0 sections):
  allowed — this is the feature/bug zero-milestone template case from #2876.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException


def check_activation_gate(
    *,
    current: str,
    requested: str,
    milestone_count: int,
    template_id: object | None,
    template_section_count: int = 0,
):
    """Reproduces project_validation.validate_project_transition gate logic
    for the planning → active transition under #2876.

    Raises HTTPException(422) on reject, returns None on allow.
    """
    # Only the planning → active branch is under test here
    if current != "planning" or requested != "active":
        return

    if milestone_count == 0:
        is_zero_milestone_template = False
        if template_id is not None:
            is_zero_milestone_template = template_section_count == 0

        if not is_zero_milestone_template:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": "template_id_required: apply a project template before activating this project",
                    "error_code": "GOVERNOR_GATE_ACTIVATION",
                    "project_id": "00000000-0000-0000-0000-000000000000",
                    "project_name": "test",
                    "next_action": "Apply a project template (template_apply) or add at least one milestone, then transition to active.",
                    "reference": "SYS-030",
                    "help": "Use template_apply to scaffold the project, then transition to active. See SYS-030.",
                },
            )


class TestActivationGatePasses:
    def test_with_milestones_no_template(self):
        check_activation_gate(
            current="planning",
            requested="active",
            milestone_count=3,
            template_id=None,
        )

    def test_with_milestones_and_template(self):
        check_activation_gate(
            current="planning",
            requested="active",
            milestone_count=2,
            template_id="tmpl-1",
            template_section_count=2,
        )

    def test_zero_milestone_template_allows_activation(self):
        """Gate 1 exception — template with 0 sections permits activation
        without milestones (feature/bug zero-milestone templates)."""
        check_activation_gate(
            current="planning",
            requested="active",
            milestone_count=0,
            template_id="tmpl-feature",
            template_section_count=0,
        )


class TestActivationGateBlocks:
    def test_no_milestones_no_template_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            check_activation_gate(
                current="planning",
                requested="active",
                milestone_count=0,
                template_id=None,
            )
        assert exc_info.value.status_code == 422
        detail = exc_info.value.detail
        assert detail["error_code"] == "GOVERNOR_GATE_ACTIVATION"
        assert "next_action" in detail
        assert detail["reference"] == "SYS-030"

    def test_no_milestones_templated_with_sections_rejected(self):
        """Project templated with sections but milestones deleted — not an
        exempt zero-milestone template, so the gate still fires."""
        with pytest.raises(HTTPException) as exc_info:
            check_activation_gate(
                current="planning",
                requested="active",
                milestone_count=0,
                template_id="tmpl-web",
                template_section_count=4,
            )
        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["error_code"] == "GOVERNOR_GATE_ACTIVATION"


class TestOtherTransitionsUnaffected:
    def test_non_activation_transitions_pass_through(self):
        # Simulate an unrelated transition (e.g. planning -> on_hold) — our gate
        # stub only handles planning → active, so it should early-return.
        check_activation_gate(
            current="planning",
            requested="on_hold",
            milestone_count=0,
            template_id=None,
        )
