"""
Milestone validation — enforces status lifecycle per SYS-006.

Transition rules: pending → active → completed, completed → active (reopen).
Conditional checks: description required for activation, all tickets resolved for completion.
Sealed completion: reject ticket assignment to completed milestones.
Completion advisory: hint when last ticket in a milestone resolves.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models


MILESTONE_TRANSITIONS = {
    "pending":   ["active"],
    "active":    ["completed"],
    "completed": ["active"],
}


def get_available_transitions(status: str) -> list[str]:
    """Return allowed target statuses for a milestone."""
    return list(MILESTONE_TRANSITIONS.get(status, []))


def validate_milestone_transition(
    current: str, requested: str, milestone, db: Session
) -> None:
    """Validate a milestone status transition with conditional checks.

    Raises HTTPException(422) if the transition is invalid or conditions are not met.
    """
    allowed = MILESTONE_TRANSITIONS.get(current, [])
    if requested not in allowed:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": f"Invalid milestone status transition: {current} → {requested}",
                "current": current,
                "requested": requested,
                "allowed": get_available_transitions(current),
                "help": "See SYS-006 for the milestone status lifecycle.",
            },
        )

    # Conditional: pending → active requires description
    if current == "pending" and requested == "active":
        if not milestone.description:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": "Milestone requires a description before activation.",
                    "current": current,
                    "requested": requested,
                    "condition": "description_required",
                    "help": "Add a description to the milestone before setting status to active. See SYS-006.",
                },
            )

    # Conditional: active → completed requires all tickets resolved/closed
    if current == "active" and requested == "completed":
        open_tickets = db.query(models.Ticket).filter(
            models.Ticket.milestone_id == milestone.id,
            models.Ticket.is_deleted == False,
            ~models.Ticket.status.in_(["resolved", "closed"]),
        ).all()
        if open_tickets:
            ticket_list = [
                {"id": t.id, "subject": t.subject, "status": t.status}
                for t in open_tickets
            ]
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": f"Cannot complete milestone — {len(open_tickets)} ticket(s) are not resolved.",
                    "current": current,
                    "requested": requested,
                    "condition": "all_tickets_resolved",
                    "open_tickets": ticket_list,
                    "help": "Resolve or close all tickets before completing the milestone. See SYS-006.",
                },
            )


def validate_milestone_sealed(milestone_id, db: Session) -> None:
    """Reject ticket creation/assignment to a completed milestone.

    Raises HTTPException(422) with milestone_sealed error if the milestone is completed.
    No-op if milestone_id is None or the milestone doesn't exist.
    """
    if not milestone_id:
        return
    milestone = db.query(models.Milestone).filter(
        models.Milestone.id == milestone_id
    ).first()
    if not milestone:
        return
    if milestone.status == "completed":
        raise HTTPException(
            status_code=422,
            detail={
                "error": "milestone_sealed",
                "milestone_id": str(milestone.id),
                "milestone_name": milestone.name,
                "milestone_status": milestone.status,
                "message": "Milestone is completed. Reopen it to active status or assign this ticket to another milestone.",
                "available_actions": ["reopen_milestone", "choose_different_milestone"],
            },
        )


def check_milestone_completion_advisory(milestone_id, db: Session) -> dict | None:
    """Check if all tickets in a milestone are now resolved/closed.

    Returns advisory dict if the milestone has zero remaining open tickets,
    or None otherwise. No-op if milestone_id is None.
    """
    if not milestone_id:
        return None
    milestone = db.query(models.Milestone).filter(
        models.Milestone.id == milestone_id
    ).first()
    if not milestone:
        return None
    open_count = db.query(func.count(models.Ticket.id)).filter(
        models.Ticket.milestone_id == milestone_id,
        models.Ticket.is_deleted == False,
        ~models.Ticket.status.in_(["resolved", "closed"]),
    ).scalar()
    if open_count == 0:
        return {
            "milestone_completion_ready": True,
            "milestone_id": str(milestone.id),
            "milestone_name": milestone.name,
            "milestone_completion_message": "All tickets in this milestone are now resolved. Consider completing the milestone.",
        }
    return None
