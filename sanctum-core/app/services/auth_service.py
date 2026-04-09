import os
from sqlalchemy.orm import Session
from ..models import User
from ..services.email_service import email_service

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

class AuthService:
    def invite_user(self, db: Session, user: User):
        """
        Send an invite email directing the user to sign in via SSO.
        """
        link = f"{FRONTEND_URL}/login"

        email_service.send_template(
            to_email=user.email,
            subject="You've Been Invited to Sanctum",
            template_name="invite.html",
            context={
                "name": user.full_name,
                "link": link
            }
        )
        return None

auth_service = AuthService()
