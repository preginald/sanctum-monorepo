from typing import Callable, Dict, List, Any
from fastapi import BackgroundTasks
from ..database import SessionLocal
from .. import models
from .email_service import email_service
import json
from datetime import datetime
from sqlalchemy.orm import Session

# Define Payload Types
EventPayload = Any
Listener = Callable[[EventPayload, BackgroundTasks], None]

class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Listener]] = {}

    def subscribe(self, event_type: str, listener: Listener):
        """Register a hardcoded code-based listener."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(listener)

    def emit(self, event_type: str, payload: EventPayload, background_tasks: BackgroundTasks):
        """
        Public entry point. 
        1. Triggers hardcoded listeners.
        2. Queues dynamic database rules in the background.
        """
        # 1. Hardcoded Listeners (Legacy/Core)
        if event_type in self._subscribers:
            for listener in self._subscribers[event_type]:
                try:
                    listener(payload, background_tasks)
                except Exception as e:
                    print(f"[EventBus] Hardcoded Listener Error: {e}")

        # 2. Dynamic Rules (The Weaver)
        # We pass the payload handling to a background worker function
        background_tasks.add_task(self._process_dynamic_rules, event_type, payload)

    def _process_dynamic_rules(self, event_type: str, payload: Any):
        """
        Worker: Fetch active rules for this event and execute them.
        """
        db = SessionLocal()
        try:
            # Fetch Active Rules
            rules = db.query(models.Automation).filter(
                models.Automation.event_type == event_type,
                models.Automation.is_active == True
            ).all()

            if not rules:
                return

            # Helper to safely serialize payload for logging
            payload_summary = str(payload)
            if hasattr(payload, 'id'): payload_summary = f"Entity ID: {payload.id}"

            for rule in rules:
                self._execute_rule(db, rule, payload, payload_summary)
                
        except Exception as e:
            print(f"[EventBus] Engine Error: {e}")
        finally:
            db.close()

    def _execute_rule(self, db, rule, payload, summary):
        """
        Execute a single automation rule and log the result.
        """
        # Create Log Entry (Pending)
        log = models.AutomationLog(
            automation_id=rule.id,
            status="running",
            output=f"Processing {summary}"
        )
        db.add(log)
        db.commit()

        try:
            output = ""
            
            # --- DISPATCHER ---
            if rule.action_type == 'log_info':
                print(f"[WEAVER] RULE '{rule.name}' TRIGGERED: {summary}")
                output = f"Logged to console: {summary}"

            elif rule.action_type == 'send_email':
                output = self._handle_email_action(rule.config, payload)
            
            elif rule.action_type == 'webhook':
                output = "Webhook not implemented yet."

            elif rule.action_type == 'create_notification':
                output = self._handle_notification_action(db, rule.config, payload)

            else:
                output = f"Unknown action type: {rule.action_type}"

            # Success
            log.status = "success"
            log.output = output

        except Exception as e:
            # Failure
            log.status = "failure"
            log.output = str(e)
            print(f"[WEAVER] Execution Failed: {e}")
        
        finally:
            log.triggered_at = datetime.now() # Update timestamp
            db.commit()

    def _handle_email_action(self, config: dict, payload: Any) -> str:
        """
        Config expects: {'target': 'admin'|'client'|'email@addr', 'template': 'string'}
        """
        target = config.get('target', 'admin')
        template = config.get('template', 'Notification')
        
        # Resolve Recipient
        to_email = None
        
        if target == 'admin':
            to_email = email_service.admin_email
        elif '@' in target:
            to_email = target
        elif target == 'client':
            # Try to resolve client email from payload
            if hasattr(payload, 'account') and payload.account:
                to_email = payload.account.billing_email
            elif hasattr(payload, 'email'): # If payload is a User/Contact
                to_email = payload.email
        
        if not to_email:
            raise ValueError(f"Could not resolve email target: {target}")

        # Resolve Content (Simple templating)
        subject = f"Automation: {template}"
        body = f"<p>Automation Rule Triggered.</p><pre>{str(payload)}</pre>"

        # 2. INTELLIGENT OVERRIDE (Ticket Context)
        if hasattr(payload, 'subject'): 
            ticket_id = payload.id
            subject = f"[Ticket #{ticket_id}] {payload.subject}"
            
            # Styles
            style_container = "font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;"
            style_header = "background-color: #0f172a; color: #fff; padding: 15px; border-radius: 6px 6px 0 0; text-align: center;"
            style_status = "display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; background-color: #22c55e; color: #fff;"
            style_body = "padding: 20px; color: #334155; line-height: 1.6;"
            style_quote = "background-color: #f8fafc; border-left: 4px solid #22c55e; padding: 15px; margin: 15px 0; font-style: italic;"
            style_footer = "text-align: center; font-size: 12px; color: #94a3b8; margin-top: 20px;"

            html_content = f"""
            <div style="{style_container}">
                <div style="{style_header}">
                    <h2 style="margin:0;">Ticket Update</h2>
                </div>
                <div style="{style_body}">
                    <p>Hello,</p>
                    <p>There has been an update to your ticket <strong>#{ticket_id}</strong>.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            """

            # If Resolution
            if hasattr(payload, 'resolution') and payload.resolution:
                html_content += f"""
                    <div style="margin-bottom: 10px;">
                        <span style="{style_status}">RESOLVED</span>
                    </div>
                    <p><strong>The issue has been marked as resolved by the technician.</strong></p>
                    <p>Resolution Details:</p>
                    <div style="{style_quote}">
                        {payload.resolution}
                    </div>
                """
            else:
                # Generic Creation/Update
                html_content += f"""
                    <p>Your ticket <strong>{payload.subject}</strong> has been received/updated.</p>
                    <p>Our team is reviewing it.</p>
                """

            html_content += f"""
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p>You can view the full status in the <a href="https://core.digitalsanctum.com.au/portal">Client Portal</a>.</p>
                </div>
                <div style="{style_footer}">
                    &copy; 2026 Digital Sanctum. Secure Systems.
                </div>
            </div>
            """
            
            body = html_content
        
        email_service.send(to_email, subject, body)
        return f"Email sent to {to_email}"

    def _handle_notification_action(self, db: Session, config: dict, payload: Any) -> str:
        """
        Config: {'target': 'admin'|'tech'|'owner', 'title': 'str', 'message': 'str'}
        """
        target = config.get('target', 'admin')
        
        # Resolve Users to notify
        users_to_notify = []
        if target == 'admin':
            users_to_notify = db.query(models.User).filter(models.User.role == 'admin').all()
        elif target == 'owner' and hasattr(payload, 'assigned_tech_id'):
            if payload.assigned_tech_id:
                users_to_notify = db.query(models.User).filter(models.User.id == payload.assigned_tech_id).all()
        
        if not users_to_notify:
            return "No users found to notify."

        for user in users_to_notify:
            notif = models.Notification(
                user_id=user.id,
                title=config.get('title', 'System Alert'),
                message=config.get('message', f"Update regarding {str(payload)}"),
                link=f"/tickets/{payload.id}" if hasattr(payload, 'id') else None
            )
            db.add(notif)
        
        db.commit()
        return f"Notifications created for {len(users_to_notify)} users."

# Global Instance
event_bus = EventBus()