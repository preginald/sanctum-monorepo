"""
Delete validation — pre-flight checks for cascading soft-deletes.

Validates that projects and milestones can be safely archived by checking
for work-in-progress indicators on child entities.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models


def validate_milestone_deletable(milestone, db: Session) -> list[dict]:
    """Check if a milestone's tickets are safe to soft-delete.

    Returns a list of blocker dicts for tickets that have started work.
    An empty list means the milestone is safe to delete.
    """
    blockers = []
    tickets = db.query(models.Ticket).filter(
        models.Ticket.milestone_id == milestone.id,
        models.Ticket.is_deleted == False,
    ).all()

    for ticket in tickets:
        reasons = []

        if ticket.status != "new":
            reasons.append("status_progressed")

        transition_count = db.query(func.count(models.TicketTransition.id)).filter(
            models.TicketTransition.ticket_id == ticket.id,
        ).scalar()
        if transition_count > 1:
            reasons.append("has_transitions")

        comment_count = db.query(func.count(models.TicketComment.id)).filter(
            models.TicketComment.ticket_id == ticket.id,
        ).scalar()
        if comment_count > 0:
            reasons.append("has_comments")

        time_entry_count = db.query(func.count(models.TicketTimeEntry.id)).filter(
            models.TicketTimeEntry.ticket_id == ticket.id,
        ).scalar()
        if time_entry_count > 0:
            reasons.append("has_time_entries")

        material_count = db.query(func.count(models.TicketMaterial.id)).filter(
            models.TicketMaterial.ticket_id == ticket.id,
        ).scalar()
        if material_count > 0:
            reasons.append("has_materials")

        if reasons:
            blockers.append({
                "ticket_id": ticket.id,
                "subject": ticket.subject,
                "reasons": reasons,
            })

    return blockers


def validate_project_deletable(project, db: Session) -> dict:
    """Check if a project and all its children are safe to soft-delete.

    Returns a dict with 'blocking_milestones' and 'blocking_tickets' lists.
    Both empty means the project is safe to delete.
    """
    blocking_milestones = []
    blocking_tickets = []

    milestones = db.query(models.Milestone).filter(
        models.Milestone.project_id == project.id,
        models.Milestone.is_deleted == False,
    ).all()

    for milestone in milestones:
        ms_reasons = []

        if milestone.status != "pending":
            ms_reasons.append("milestone_activated")

        if milestone.invoice_id is not None:
            ms_reasons.append("has_invoice")

        if ms_reasons:
            blocking_milestones.append({
                "milestone_id": str(milestone.id),
                "name": milestone.name,
                "reasons": ms_reasons,
            })

        ticket_blockers = validate_milestone_deletable(milestone, db)
        blocking_tickets.extend(ticket_blockers)

    return {
        "blocking_milestones": blocking_milestones,
        "blocking_tickets": blocking_tickets,
    }
