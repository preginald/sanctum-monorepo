import secrets
import os
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from ..models import PasswordToken, User
from ..services.email_service import email_service
from .. import auth 

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

class AuthService:
    def invite_user(self, db: Session, user: User):
        """
        Generates a token, saves it (raw + hash), and sends the invite email.
        Consolidated logic for CRM and Auth routers.
        """
        # 1. Generate High-Entropy Token
        raw_token = secrets.token_urlsafe(32)
        token_hash = auth.get_password_hash(raw_token)

        # 2. Cleanup old tokens for this user (Optional, keeps DB clean)
        db.query(PasswordToken).filter(PasswordToken.user_id == user.id).delete()

        # 3. Create Record
        # We store raw_token in 'token' column because the current lookup logic 
        # in auth.py uses equality check, not hash verification. 
        # Ideally, we'd only store hash, but that requires refactoring /set-password too.
        expiry = datetime.now(timezone.utc) + timedelta(hours=24)
        
        token_entry = PasswordToken(
            user_id=user.id,
            token=raw_token,
            token_hash=token_hash,
            expires_at=expiry
        )
        db.add(token_entry)
        db.commit()

        # 4. Construct Link
        link = f"{FRONTEND_URL}/set-password?token={raw_token}&email={user.email}"

        # 5. Dispatch Email
        email_service.send_template(
            to_email=user.email,
            subject="Activate Your Sanctum Account",
            template_name="invite.html",
            context={
                "name": user.full_name,
                "link": link
            }
        )
        return raw_token

auth_service = AuthService()