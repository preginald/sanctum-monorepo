"""
Portal user provisioning service.

Convergence logic: ensure a User exists for a contact and send invite if newly created.
Extracted from routers/crm.py POST /contacts for shared use by POST and PUT endpoints.
"""
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from .. import models
from .auth_service import auth_service
from .event_bus import event_bus


def provision_portal_user(
    db: Session,
    contact: models.Contact,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Ensure a User record exists for the given contact and send an invite.

    Returns a dict with keys:
        status: "created" | "skipped" | "error"
        reason: (only when skipped) "no_email" | "user_exists"
        user_id: (when created or user_exists) str UUID
        error: (only when status=error) error message
    """
    if not contact.email:
        return {"status": "skipped", "reason": "no_email"}

    existing_user = db.query(models.User).filter(
        models.User.email == contact.email
    ).first()

    if existing_user:
        return {
            "status": "skipped",
            "reason": "user_exists",
            "user_id": str(existing_user.id),
        }

    try:
        # Create SSO-only user (no local password)
        new_user = models.User(
            email=contact.email,
            password_hash=None,
            full_name=f"{contact.first_name} {contact.last_name}",
            role="client",
            access_scope="restricted",
            account_id=contact.account_id,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Send invite email
        auth_service.invite_user(db, new_user)

        # Emit success event
        event_bus.emit(
            "portal_user_provisioned",
            {
                "contact_id": str(contact.id),
                "user_id": str(new_user.id),
                "email": new_user.email,
                "account_id": str(contact.account_id),
            },
            background_tasks,
        )

        return {"status": "created", "user_id": str(new_user.id)}

    except Exception as e:
        db.rollback()
        # Emit failure event
        try:
            event_bus.emit(
                "portal_user_provision_failed",
                {
                    "contact_id": str(contact.id),
                    "email": contact.email,
                    "account_id": str(contact.account_id),
                    "error": str(e),
                },
                background_tasks,
            )
        except Exception:
            pass  # Don't let event emission failure mask the original error

        return {"status": "error", "error": str(e)}
