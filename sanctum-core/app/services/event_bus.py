from typing import Callable, Dict, List, Any
from fastapi import BackgroundTasks
from ..database import SessionLocal
from .. import models
from .email_service import email_service
import json
from datetime import datetime

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

        # Context-aware overrides
        if hasattr(payload, 'subject'): # It's a Ticket
            subject = f"Ticket Update: {payload.subject}"
            body = f"<h1>Ticket Update</h1><p>Action required on Ticket #{payload.id}.</p>"
        
        email_service.send(to_email, subject, body)
        return f"Email sent to {to_email}"

# Global Instance
event_bus = EventBus()
