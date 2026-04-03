"""
Project validation — enforces status lifecycle per SYS-030.

Transition rules: derived from SYS-030 at runtime via governance provider.
Conditional checks: at least one milestone required for activation.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models
from .governance import get_project_transitions as _gov_project_transitions, get_allowed_project_statuses


def get_available_transitions(status: str, db: Session) -> list[str]:
    """Return allowed target statuses for a project."""
    transitions_map = _gov_project_transitions(db)
    return list(transitions_map.get(status, []))


def validate_project_status(status: str, db: Session) -> None:
    """Validate project status against SYS-030 controlled vocabulary."""
    allowed = get_allowed_project_statuses(db)
    if status not in allowed:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": f"Invalid project status: '{status}'",
                "allowed": allowed,
                "reference": "SYS-030",
                "help": "See SYS-030 Controlled Vocabularies > Statuses.",
            },
        )


def validate_project_transition(
    current: str, requested: str, project, db: Session
) -> None:
    """Validate a project status transition with conditional checks.

    Raises HTTPException(422) if the transition is invalid or conditions are not met.
    """
    transitions_map = _gov_project_transitions(db)
    allowed = transitions_map.get(current, [])
    if requested not in allowed:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": f"Invalid project status transition: {current} → {requested}",
                "current": current,
                "requested": requested,
                "allowed": get_available_transitions(current, db),
                "reference": "SYS-030",
                "help": "See SYS-030 for the project status lifecycle.",
            },
        )

    # Conditional: planning → active requires template_id or at least one milestone
    if current == "planning" and requested == "active":
        milestone_count = db.query(models.Milestone).filter(
            models.Milestone.project_id == project.id,
        ).count()
        if project.template_id is None and milestone_count == 0:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": "template_id_required: apply a project template before activating this project",
                    "error_code": "template_id_required",
                    "project_id": str(project.id),
                    "project_name": project.name,
                    "help": "Use template_apply to scaffold the project, then transition to active. See SYS-030.",
                },
            )

    # Conditional: active → completed requires all milestones completed
    if current == "active" and requested == "completed":
        incomplete = db.query(models.Milestone).filter(
            models.Milestone.project_id == project.id,
            models.Milestone.status != "completed",
        ).all()
        if incomplete:
            ms_list = [
                {"id": str(m.id), "name": m.name, "status": m.status}
                for m in incomplete
            ]
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": f"Cannot complete project — {len(incomplete)} milestone(s) are not completed.",
                    "current": current,
                    "requested": requested,
                    "condition": "all_milestones_completed",
                    "incomplete_milestones": ms_list,
                    "help": "Complete all milestones before completing the project. See SYS-030.",
                },
            )
