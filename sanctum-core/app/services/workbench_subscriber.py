"""
Event subscriber for workbench in_app notifications (#2758).

Listens on ticket_status_change and ticket_comment events.
Creates in_app Notification records for users who have the ticket's
project pinned on their workbench, excluding the actor.
"""

import logging
from datetime import datetime, timezone, timedelta

from fastapi import BackgroundTasks
from sqlalchemy import and_

from ..database import SessionLocal
from .. import models

logger = logging.getLogger(__name__)

DEDUP_WINDOW_SECONDS = 60


def handle_workbench_ticket_event(payload: dict, background_tasks: BackgroundTasks):
    """
    EventBus listener for ticket_status_change and ticket_comment events.

    Schedules the actual DB work as a background task (consistent with
    audit_subscriber pattern).
    """
    background_tasks.add_task(_process_workbench_notification, payload)


def _process_workbench_notification(payload: dict):
    """
    Background task: look up project from ticket, find pinned users,
    create in_app notifications with dedup.
    """
    db = SessionLocal()
    try:
        ticket_id = payload.get("ticket_id")
        actor_user_id = payload.get("actor_user_id")
        event_type = payload.get("event_type")

        if not ticket_id or not event_type:
            return

        # Resolve project_id via ticket -> milestone -> project
        ticket = db.query(models.Ticket).filter(
            models.Ticket.id == ticket_id
        ).first()
        if not ticket or not ticket.milestone_id:
            return

        milestone = db.query(models.Milestone).filter(
            models.Milestone.id == ticket.milestone_id
        ).first()
        if not milestone or not milestone.project_id:
            return

        project_id = milestone.project_id

        # Resolve project and milestone names for enriched notification title
        project = db.query(models.Project).filter(
            models.Project.id == project_id
        ).first()
        project_name = project.name if project else "Unknown Project"
        milestone_name = milestone.name if milestone else ""

        # Find all users who have this project pinned
        pins = db.query(models.WorkbenchPin).filter(
            models.WorkbenchPin.project_id == project_id
        ).all()

        if not pins:
            return

        now = datetime.now(timezone.utc)
        dedup_cutoff = now - timedelta(seconds=DEDUP_WINDOW_SECONDS)

        for pin in pins:
            # Exclude the actor from receiving their own notification
            if actor_user_id and str(pin.user_id) == str(actor_user_id):
                continue

            # Dedup: skip if same user/project/event_type within window
            existing = db.query(models.Notification).filter(
                and_(
                    models.Notification.user_id == pin.user_id,
                    models.Notification.project_id == project_id,
                    models.Notification.event_type == event_type,
                    models.Notification.delivery_channel == 'in_app',
                    models.Notification.created_at > dedup_cutoff,
                )
            ).first()
            if existing:
                continue

            # Build notification content with project/milestone context
            raw_title = payload.get("title", f"Ticket #{ticket_id} update")
            if milestone_name:
                title = f"[{project_name}] {raw_title} ({milestone_name})"
            else:
                title = f"[{project_name}] {raw_title}"
            message = payload.get("message", "")
            link = payload.get("link", f"/tickets/{ticket_id}")

            note = models.Notification(
                user_id=pin.user_id,
                title=title,
                message=message,
                link=link,
                priority=payload.get("priority", "normal"),
                event_payload=payload,
                event_type=event_type,
                status="delivered",
                delivery_channel="in_app",
                project_id=project_id,
                is_read=False,
            )
            db.add(note)

        db.commit()

    except Exception as e:
        db.rollback()
        logger.error(f"[WorkbenchSubscriber] Error: {e}", exc_info=True)
    finally:
        db.close()
