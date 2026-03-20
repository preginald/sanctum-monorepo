"""
Milestone validation — enforces status lifecycle per SYS-006.

Transition rules: pending → active → completed, completed → active (reopen).
Conditional checks: description required for activation, all tickets resolved for completion.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

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
