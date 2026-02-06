import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Automation, Base
from app.database import SQLALCHEMY_DATABASE_URL

# Setup DB Connection
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

DEFAULT_RULES = [
    {
        "name": "Notify Admin on New Ticket",
        "description": "Alerts the admin team when a client opens a new ticket.",
        "event_type": "ticket_created",
        "action_type": "create_notification",
        "config": {
            "target": "admin",
            "title": "New Ticket Created",
            "message": "A new ticket has been submitted."
        },
        "is_active": True
    },
    {
        "name": "Notify Client on Resolution",
        "description": "Notifies the client contact and billing email when a ticket is resolved.",
        "event_type": "ticket_resolved",
        "action_type": "send_email",
        "config": {
            "target": "client",
            "template": "notification"
        },
        "is_active": True
    }
]

def seed():
    db = SessionLocal()
    print("🌱 Seeding Automations...")
    
    try:
        for rule_def in DEFAULT_RULES:
            exists = db.query(Automation).filter(Automation.event_type == rule_def['event_type']).first()
            if not exists:
                print(f"   Creating rule: {rule_def['name']}")
                rule = Automation(**rule_def)
                db.add(rule)
            else:
                print(f"   Skipping rule (exists): {rule_def['name']}")
        
        db.commit()
        print("✅ Automation Seeding Complete.")
        
    except Exception as e:
        print(f"❌ Error seeding automations: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()