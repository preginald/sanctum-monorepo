"""
Cascading status lifecycle — automatic status propagation from children to parents.

When a ticket status changes, the parent milestone status is recomputed.
When a milestone status changes, the parent project status is recomputed.
Cascading is suppressed when a project is on_hold.

Rules are documented in SYS-030 (Project Standards).
"""
import logging
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models

logger = logging.getLogger(__name__)

# Ticket statuses that indicate active work
ACTIVE_TICKET_STATUSES = {"open", "recon", "proposal", "implementation", "verification", "review", "pending"}
# Ticket statuses that indicate completion
TERMINAL_TICKET_STATUSES = {"resolved", "closed"}


def compute_milestone_status(milestone, db: Session) -> str | None:
    """Compute what a milestone's status should be based on its tickets.

    Returns the computed status, or None if the milestone should not change.
    """
    tickets = db.query(models.Ticket.status).filter(
        models.Ticket.milestone_id == milestone.id,
        models.Ticket.is_deleted == False,
    ).all()

    if not tickets:
        computed = "pending"
    else:
        statuses = {t.status for t in tickets}
        if statuses & ACTIVE_TICKET_STATUSES:
            computed = "active"
        elif statuses <= TERMINAL_TICKET_STATUSES:
            computed = "completed"
        elif all(s == "new" for s in statuses):
            computed = "pending"
        else:
            # Mixed state with non-new, non-active, non-terminal — treat as active
            computed = "active"

    if computed == milestone.status:
        return None
    return computed


def compute_project_status(project, db: Session) -> str | None:
    """Compute what a project's status should be based on its milestones.

    Returns the computed status, or None if the project should not change.
    Returns None if the project is on_hold (cascading suppressed).
    """
    if project.status in ("on_hold", "capture"):
        return None

    milestones = db.query(models.Milestone.status).filter(
        models.Milestone.project_id == project.id,
    ).all()

    if not milestones:
        computed = "planning"
    else:
        statuses = {m.status for m in milestones}
        if "active" in statuses:
            computed = "active"
        elif statuses == {"completed"}:
            computed = "completed"
        elif statuses <= {"pending"}:
            computed = "planning"
        else:
            # Mix of pending and completed (no active) — still active overall
            computed = "active"

    if computed == project.status:
        return None
    return computed


def cascade_from_ticket(ticket, db: Session) -> None:
    """After a ticket status change, cascade to milestone and project.

    Computes and applies milestone status, then cascades upward to project.
    Changes are made within the caller's transaction (no extra commit).
    """
    if not ticket.milestone_id:
        return

    milestone = db.query(models.Milestone).filter(
        models.Milestone.id == ticket.milestone_id
    ).first()
    if not milestone:
        return

    new_ms_status = compute_milestone_status(milestone, db)
    if new_ms_status:
        logger.info(
            "Cascade: ticket #%s → milestone '%s' status %s → %s",
            ticket.id, milestone.name, milestone.status, new_ms_status,
        )
        milestone.status = new_ms_status
        db.flush()
        # Continue cascading upward
        cascade_from_milestone(milestone, db)


def cascade_from_milestone(milestone, db: Session) -> None:
    """After a milestone status change, cascade to project.

    Computes and applies project status.
    Changes are made within the caller's transaction (no extra commit).
    """
    if not milestone.project_id:
        return

    project = db.query(models.Project).filter(
        models.Project.id == milestone.project_id
    ).first()
    if not project:
        return

    new_proj_status = compute_project_status(project, db)
    if new_proj_status:
        logger.info(
            "Cascade: milestone '%s' → project '%s' status %s → %s",
            milestone.name, project.name, project.status, new_proj_status,
        )
        project.status = new_proj_status
        db.flush()
