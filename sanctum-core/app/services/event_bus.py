from typing import Callable, Dict, List, Any
from fastapi import BackgroundTasks
from ..database import SessionLocal
from .. import models
# NEW IMPORTS
from .notification_router import notification_router
from .notification_service import notification_service 

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
        """
        # 1. Hardcoded Listeners
        if event_type in self._subscribers:
            for listener in self._subscribers[event_type]:
                try:
                    listener(payload, background_tasks)
                except Exception as e:
                    print(f"[EventBus] Hardcoded Listener Error: {e}")

        # 2. Dynamic Rules (The Weaver)
        background_tasks.add_task(self._process_dynamic_rules, event_type, payload)

    def _process_dynamic_rules(self, event_type: str, payload: Any):
        """
        Worker: Fetch active rules for this event and execute them.
        """
        db = SessionLocal()
        try:
            rules = db.query(models.Automation).filter(
                models.Automation.event_type == event_type,
                models.Automation.is_active == True
            ).all()

            if not rules: return

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
        Execute a single automation rule.
        """
        log = models.AutomationLog(
            automation_id=rule.id,
            status="running",
            output=f"Processing {summary}"
        )
        db.add(log)
        db.commit()

        try:
            output = ""
            
            if rule.action_type == 'log_info':
                print(f"[WEAVER] RULE '{rule.name}' TRIGGERED: {summary}")
                output = f"Logged to console."

            elif rule.action_type == 'send_email':
                # --- NEW UNIFIED ROUTING ---
                output = self._handle_unified_dispatch(db, rule.config, payload)
            
            elif rule.action_type == 'webhook':
                output = "Webhook not implemented yet."
            
            elif rule.action_type == 'create_notification':
                # Also use unified dispatch, just configured differently via priorities if needed
                # For now, mapping it to the same pipe but strictly In-App can be handled by Router later
                # Mapped to unified for now:
                output = self._handle_unified_dispatch(db, rule.config, payload)

            else:
                output = f"Unknown action type: {rule.action_type}"

            log.status = "success"
            log.output = output

        except Exception as e:
            log.status = "failure"
            log.output = str(e)
            print(f"[WEAVER] Execution Failed: {e}")
        
        finally:
            log.triggered_at = datetime.now()
            db.commit()

    def _handle_unified_dispatch(self, db: Session, config: dict, payload: Any) -> str:
        """
        1. Router determines WHO.
        2. Service determines HOW (Queue/Send).
        """
        target_type = config.get('target', 'admin')
        template_name = config.get('template', 'Notification')
        
        # 1. ROUTER (Who?)
        recipients = notification_router.resolve_recipients(db, target_type, payload)
        
        if not recipients:
            return f"No recipients resolved for target: {target_type}"
            
        # 2. CONTENT BUILDER (Snapshot)
        subject = f"Automation: {template_name}"
        priority = 'normal'
        link = None
        event_payload = {}
        
        # Ticket Context
        if hasattr(payload, 'subject') and hasattr(payload, 'id'):
             subject = f"[Ticket #{payload.id}] {payload.subject}"
             link = f"/tickets/{payload.id}"
             event_payload = {
                 "entity": "ticket",
                 "id": payload.id,
                 "subject": payload.subject,
                 "status": getattr(payload, 'status', 'unknown')
             }
             if hasattr(payload, 'priority'): priority = payload.priority
             
             message = f"Ticket update: {payload.subject}"
             if hasattr(payload, 'resolution') and payload.resolution:
                 message = f"Ticket Resolved: {payload.resolution}"
        else:
             message = f"System event: {template_name}"
        
        # 3. SERVICE (Enqueue & Dispatch)
        count = notification_service.enqueue(
            db=db,
            recipients=recipients,
            subject=subject,
            message=message,
            link=link,
            event_payload=event_payload,
            priority=priority
        )
        
        return f"Queued {len(recipients)} notifications. Immediate dispatch: {count}"

event_bus = EventBus()