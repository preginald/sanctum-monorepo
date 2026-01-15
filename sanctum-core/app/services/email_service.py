import os
import resend
import logging
from dotenv import load_dotenv

load_dotenv()

# Setup Logger
logger = logging.getLogger("sanctum.email")
logging.basicConfig(level=logging.INFO)

class EmailService:
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY")
        if not self.api_key:
            logger.warning("RESEND_API_KEY not found in env. Email disabled.")
        else:
            resend.api_key = self.api_key
            
        self.system_email = "notifications@digitalsanctum.com.au"
        self.admin_email = "hello@digitalsanctum.com.au"

    def send(self, to_emails, subject: str, html_content: str, cc_emails=None, attachments=None):
        if not self.api_key:
            logger.info(f"[MOCK EMAIL] To: {to_emails} | Subject: {subject}")
            return True # Pretend success in dev without key

        if isinstance(to_emails, str): to_emails = [to_emails]
        if isinstance(cc_emails, str): cc_emails = [cc_emails]

        try:
            params = {
                "from": f"Sanctum Core <{self.system_email}>",
                "to": to_emails,
                "subject": subject,
                "html": html_content,
            }
            if cc_emails: params["cc"] = cc_emails

            # Handle Attachments
            if attachments:
                att_list = []
                for path in attachments:
                    try:
                        with open(path, "rb") as f:
                            content = list(f.read())
                            filename = os.path.basename(path)
                            att_list.append({"filename": filename, "content": content})
                    except Exception as e:
                        logger.error(f"Failed to read attachment {path}: {e}")
                        # Don't fail the whole email for one bad attachment, but log it
                
                if att_list: params["attachments"] = att_list

            resp = resend.Emails.send(params)
            logger.info(f"Email Sent ID: {resp.get('id')}")
            return True

        except Exception as e:
            logger.error(f"EMAIL FAILED: {str(e)}")
            # Do not raise exception to crash the request, but return False so caller knows
            return False

email_service = EmailService()