from sqlalchemy.orm import Session
from datetime import datetime, timezone
import json
from ..models import Notification, User, UserNotificationPreference
from .email_service import email_service

class NotificationDispatcher:
    
    def enqueue(self, db: Session, recipients: list[dict], subject: str, message: str, link: str = None, event_payload: dict = {}, priority: str = 'normal'):
        """
        The Entry Point. 
        1. Creates DB records for ALL recipients (User or External).
        2. Checks logic: External -> Send Now. User -> Check Prefs.
        """
        dispatched_count = 0

        for r in recipients:
            # 1. Create the Record (The Queue)
            note = Notification(
                user_id=r['user_id'],
                recipient_email=r['email'],
                title=subject,
                message=message,
                link=link,
                priority=priority,
                event_payload=event_payload,
                status='pending', # Default start state
                delivery_channel='email', # Default for now
                is_read=False
            )
            db.add(note)
            db.flush() # Get ID
            
            # 2. Dispatch Logic
            should_send_now = False
            
            if r['type'] == 'external':
                # Rule: External contacts always get Realtime (they have no portal to check)
                should_send_now = True
            
            elif r['type'] == 'user' and r['user_id']:
                # Rule: Check User Preferences
                prefs = db.query(UserNotificationPreference).filter(UserNotificationPreference.user_id == r['user_id']).first()
                
                if not prefs:
                    should_send_now = True # Default Realtime
                elif priority == 'critical' and prefs.force_critical:
                    should_send_now = True
                elif prefs.email_frequency == 'realtime':
                    should_send_now = True
                # Else: Leave as 'pending' for the hourly worker
            
            # 3. Execution
            if should_send_now:
                self._send_immediate(db, note)
                dispatched_count += 1
            
        db.commit()
        return dispatched_count

    def _send_immediate(self, db: Session, note: Notification):
        """
        Performs the SMTP call and updates status.
        """
        try:
            html_content = self._render_html(note.title, note.message, note.link, note.priority)
            
            success = email_service.send(
                to_emails=[note.recipient_email],
                subject=f"Sanctum: {note.title}",
                html_content=html_content
            )

            if success:
                note.status = 'sent'
                note.sent_at = datetime.now(timezone.utc)
            else:
                note.status = 'failed'
                
        except Exception as e:
            print(f"Error dispatching notification {note.id}: {e}")
            note.status = 'failed'

    def _render_html(self, title: str, message: str, link: str = None, priority: str = 'normal') -> str:
        """
        Unified HTML Generator.
        """
        style_container = "font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;"
        style_header = "background-color: #0f172a; color: #fff; padding: 15px; border-radius: 6px 6px 0 0; text-align: center;"
        style_body = "padding: 20px; color: #334155; line-height: 1.6;"
        style_footer = "text-align: center; font-size: 12px; color: #94a3b8; margin-top: 20px;"
        
        btn_html = ""
        if link:
            # Hardcoded base URL for simplicity in this phase
            full_link = f"https://core.digitalsanctum.com.au{link}" if link.startswith("/") else link
            btn_html = f"""
            <div style="text-align: center; margin: 20px 0;">
                <a href="{full_link}" style="background-color: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Details</a>
            </div>
            """

        return f"""
        <div style="{style_container}">
            <div style="{style_header}">
                <h2 style="margin:0;">{title}</h2>
            </div>
            <div style="{style_body}">
                <p>{message}</p>
                {btn_html}
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="font-size: 12px; color: #64748b;">Priority: {priority.upper()}</p>
            </div>
            <div style="{style_footer}">
                &copy; 2026 Digital Sanctum. Secure Systems.
            </div>
        </div>
        """

notification_service = NotificationDispatcher()