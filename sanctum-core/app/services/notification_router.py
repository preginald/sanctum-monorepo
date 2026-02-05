from sqlalchemy.orm import Session, joinedload
from .. import models
from .email_service import email_service

class NotificationRouter:
    """
    The Brain: Resolves abstract targets (e.g. 'client', 'tech') into 
    concrete lists of recipients (Users and External Contacts).
    """

    def resolve_recipients(self, db: Session, target_type: str, payload: any) -> list[dict]:
        """
        Returns a list of dictionaries:
        [
            {"email": "john@example.com", "user_id": uuid, "type": "user"},
            {"email": "billing@example.com", "user_id": None, "type": "external"}
        ]
        """
        recipients = {} # Use dict with email key to deduplicate

        # 1. RESOLVE "CLIENT" (The Composite Target)
        if target_type == 'client':
            self._resolve_client(db, payload, recipients)

        # 2. RESOLVE "ADMIN"
        elif target_type == 'admin':
            admins = db.query(models.User).filter(models.User.role == 'admin').all()
            for admin in admins:
                self._add_recipient(recipients, admin.email, admin.id, 'user')
            # Fallback if no admin users in DB (rare)
            if not admins:
                self._add_recipient(recipients, email_service.admin_email, None, 'external')

        # 3. RESOLVE "OWNER" (Assigned Tech)
        elif target_type == 'owner':
            if hasattr(payload, 'assigned_tech_id') and payload.assigned_tech_id:
                tech = db.query(models.User).filter(models.User.id == payload.assigned_tech_id).first()
                if tech:
                    self._add_recipient(recipients, tech.email, tech.id, 'user')

        # 4. RESOLVE SPECIFIC EMAIL
        elif '@' in target_type:
             # Check if this specific email matches a user
             user = db.query(models.User).filter(models.User.email == target_type).first()
             if user:
                 self._add_recipient(recipients, user.email, user.id, 'user')
             else:
                 self._add_recipient(recipients, target_type, None, 'external')

        return list(recipients.values())

    def _resolve_client(self, db: Session, payload: any, recipients: dict):
        """
        Logic: Ticket Contacts (M:N) + Account Billing Email
        """
        # Re-hydrate if needed (ensure relationships are loaded)
        entity = payload
        if hasattr(payload, 'id') and hasattr(payload, '__tablename__') and payload.__tablename__ == 'tickets':
             entity = db.query(models.Ticket).options(
                 joinedload(models.Ticket.contacts),
                 joinedload(models.Ticket.account)
             ).filter(models.Ticket.id == payload.id).first()

        # A. Ticket Contacts (The Humans)
        if hasattr(entity, 'contacts'):
            for contact in entity.contacts:
                if contact.email:
                    # Is this contact also a User?
                    user = db.query(models.User).filter(models.User.email == contact.email).first()
                    if user:
                        self._add_recipient(recipients, user.email, user.id, 'user')
                    else:
                        self._add_recipient(recipients, contact.email, None, 'external')

        # B. Account Billing (The Fail-safe)
        if hasattr(entity, 'account') and entity.account and entity.account.billing_email:
            email = entity.account.billing_email
            # Check if User
            user = db.query(models.User).filter(models.User.email == email).first()
            if user:
                self._add_recipient(recipients, user.email, user.id, 'user')
            else:
                self._add_recipient(recipients, email, None, 'external')
        
        # C. Fallback (Direct Attribute)
        if hasattr(entity, 'email') and entity.email:
             self._add_recipient(recipients, entity.email, None, 'external')

    def _add_recipient(self, registry: dict, email: str, user_id, r_type: str):
        if not email: return
        normalized = email.lower().strip()
        registry[normalized] = {
            "email": normalized,
            "user_id": user_id,
            "type": r_type
        }

notification_router = NotificationRouter()