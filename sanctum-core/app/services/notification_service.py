from sqlalchemy.orm import Session
from datetime import datetime, timezone
from ..models import Notification, User
from .email_service import email_service

class NotificationDispatcher:
    def notify(self, db: Session, user: User, title: str, message: str, link: str = None, priority: str = 'normal', event_type: str = 'system'):
        """
        The Central Nervous System for alerts.
        Decides if a notification sends NOW or LATER based on preferences.
        """
        
        # 1. PERSIST (The Outbox Pattern)
        # We save it as 'pending' first. This ensures auditability.
        notification = Notification(
            user_id=user.id,
            title=title,
            message=message,
            link=link,
            priority=priority,
            event_type=event_type,
            status='pending',
            is_read=False
        )
        db.add(notification)
        db.commit() 
        db.refresh(notification)

        # 2. EVALUATE PREFERENCES
        # Access the relationship defined in models.py
        prefs = user.notification_preferences
        
        should_send_email = False
        
        if not prefs:
            # Default behavior (Safe Mode): Send everything immediately if no prefs set
            should_send_email = True
        else:
            # RULE A: Critical Override
            # If it's critical and user wants to force critical alerts, send NOW.
            if priority == 'critical' and prefs.force_critical:
                should_send_email = True
            
            # RULE B: Frequency Check
            elif prefs.email_frequency == 'realtime':
                should_send_email = True
            
            # RULE C: Batching (Hourly/Daily)
            else:
                # Do nothing. It stays 'pending' for the Worker to pick up later.
                should_send_email = False

        # 3. DISPATCH (If applicable)
        if should_send_email:
            self._dispatch_email(db, notification, user)

        return notification

    def _dispatch_email(self, db: Session, note: Notification, user: User):
        """
        Helper to send the email and update the DB record status.
        """
        try:
            # Construct a basic HTML wrapper
            # In future phases, we can use Jinja2 templates here
            html_content = f"""
            <h3>{note.title}</h3>
            <p>{note.message}</p>
            {f'<p><a href="{note.link}">View Item</a></p>' if note.link else ''}
            <hr>
            <small>Priority: {note.priority.upper()} | Sanctum Core</small>
            """
            
            success = email_service.send(
                to_emails=user.email,
                subject=f"Sanctum: {note.title}",
                html_content=html_content
            )

            if success:
                note.status = 'sent'
                note.sent_at = datetime.now(timezone.utc)
            else:
                note.status = 'failed'
            
            db.commit()
            
        except Exception as e:
            print(f"Error dispatching notification {note.id}: {e}")
            note.status = 'failed'
            db.commit()

notification_service = NotificationDispatcher()