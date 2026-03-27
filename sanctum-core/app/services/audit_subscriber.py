"""
Event subscriber for template_applied events.

When a template with category="audit" is applied, this subscriber:
1. Queries the account for its website URL
2. Queries the primary contact for name/email
3. Calls the Sanctum Audit API to trigger a baseline scan
4. Creates an artefact linked to the project and account
"""

import logging
from fastapi import BackgroundTasks
from ..database import SessionLocal
from .. import models
from .audit_client import trigger_audit, AuditAPIError

logger = logging.getLogger(__name__)


def _notify_admins(db, title: str, message: str, link: str = None):
    """Create in-app notifications for all admin users."""
    admins = db.query(models.User).filter(models.User.role == "admin").all()
    for admin in admins:
        db.add(models.Notification(
            user_id=admin.id,
            recipient_email=admin.email,
            title=title,
            message=message,
            link=link,
            status="pending",
            delivery_channel="in_app",
            is_read=False,
        ))
    db.flush()


def handle_template_applied(payload: dict, background_tasks: BackgroundTasks):
    """
    EventBus listener for 'template_applied' events.

    The listener itself just checks template category and schedules
    the actual work as a background task (per reviewer observation #1:
    use background_tasks.add_task() to handle sync/async mismatch).
    """
    template_category = payload.get("template_category")

    # Only trigger for audit templates (reviewer observation #3:
    # match on category rather than name string)
    if template_category != "audit":
        return

    background_tasks.add_task(
        _process_audit_scan,
        account_id=payload.get("account_id"),
        entity_id=payload.get("entity_id"),
        template_name=payload.get("template_name"),
    )


def _process_audit_scan(account_id: str, entity_id: str, template_name: str):
    """
    Background task: query account/contact, call Audit API, create artefact.

    Runs outside the request lifecycle with its own DB session.
    """
    db = SessionLocal()
    try:
        account = db.query(models.Account).filter(
            models.Account.id == account_id
        ).first()

        if not account:
            logger.error(
                f"[AuditSubscriber] Account {account_id} not found"
            )
            return

        # Check website URL (AC #7: graceful failure with notification)
        if not account.website:
            logger.warning(
                f"[AuditSubscriber] Website audit skipped -- "
                f"no URL on record for {account.name}"
            )
            _notify_admins(
                db,
                title="Website audit skipped",
                message=(
                    f"The baseline audit scan was skipped for "
                    f"{account.name} because no website URL is on record. "
                    f"Add a URL to the account and retry manually."
                ),
                link=f"/accounts/{account_id}",
            )
            db.commit()
            return

        # Query primary contact (reviewer observation #2: handle missing contact)
        contact = db.query(models.Contact).filter(
            models.Contact.account_id == account_id,
            models.Contact.is_primary_contact == True,
        ).first()

        if contact and contact.email:
            contact_name = f"{contact.first_name} {contact.last_name}".strip()
            contact_email = contact.email
        elif account.billing_email:
            # Fallback to billing email when no primary contact
            contact_name = account.name
            contact_email = account.billing_email
            logger.info(
                f"[AuditSubscriber] No primary contact for {account.name}, "
                f"using billing_email as fallback"
            )
        else:
            logger.warning(
                f"[AuditSubscriber] Website audit skipped -- "
                f"no contact email available for {account.name}"
            )
            return

        # Call Sanctum Audit API
        try:
            result = trigger_audit(
                url=account.website,
                name=contact_name,
                email=contact_email,
                business_name=account.name,
            )
        except AuditAPIError as e:
            # AC #8: project already created, surface warning via notification
            logger.error(
                f"[AuditSubscriber] Audit API call failed for "
                f"{account.name}: {e.message}"
            )
            _notify_admins(
                db,
                title="Website audit scan failed",
                message=(
                    f"The Sanctum Audit API call failed for "
                    f"{account.name}: {e.message}. "
                    f"The project was created successfully. "
                    f"The scan can be retried manually."
                ),
                link=f"/projects/{entity_id}",
            )
            db.commit()
            return

        # Create artefact with audit report URL
        artefact = models.Artefact(
            name=f"Baseline Audit -- {account.name}",
            artefact_type="url",
            url=result["report_url"],
            category="audit_report",
            status="draft",
            account_id=account_id,
            description=(
                f"Automated baseline scan triggered by applying "
                f"'{template_name}' template. "
                f"Audit ID: {result['id']}. "
                f"Status: {result.get('status', 'scanning')}."
            ),
        )
        db.add(artefact)
        db.flush()

        # Link artefact to project
        db.add(models.ArtefactLink(
            artefact_id=artefact.id,
            linked_entity_type="project",
            linked_entity_id=str(entity_id),
        ))

        # Link artefact to account (per SOP-104 section 6.3)
        db.add(models.ArtefactLink(
            artefact_id=artefact.id,
            linked_entity_type="account",
            linked_entity_id=str(account_id),
        ))

        db.commit()
        logger.info(
            f"[AuditSubscriber] Audit triggered for {account.name} -- "
            f"artefact {artefact.id}, report: {result['report_url']}"
        )

    except Exception as e:
        db.rollback()
        logger.error(
            f"[AuditSubscriber] Unexpected error: {e}", exc_info=True
        )
    finally:
        db.close()
