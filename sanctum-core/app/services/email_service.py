import os
import resend
from dotenv import load_dotenv

load_dotenv()

class EmailService:
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY")
        if not self.api_key:
            print("WARNING: RESEND_API_KEY not found in env.")
        resend.api_key = self.api_key
        # Update this to your verified domain sender
        self.system_email = "notifications@digitalsanctum.com.au"
        self.admin_email = "hello@digitalsanctum.com.au"

    def send(self, to_email: str, subject: str, html_content: str):
        """
        Sends an email via Resend.
        """
        if not self.api_key:
            print(f"[Mock Email] To: {to_email} | Subject: {subject}")
            return False

        try:
            params = {
                "from": f"Sanctum Core <{self.system_email}>",
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }

            email = resend.Emails.send(params)
            print(f"Email sent to {to_email}: {email}")
            return True
        except Exception as e:
            print(f"Email Error: {str(e)}")
            return False

# Singleton instance
email_service = EmailService()