import os
import resend
import logging
from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader

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

        # JINJA2 SETUP
        # Points to app/templates/emails/
        current_dir = os.path.dirname(os.path.abspath(__file__))
        template_dir = os.path.join(current_dir, '../templates/emails')
        self.env = Environment(loader=FileSystemLoader(template_dir))

    def send_template(self, to_email: str, subject: str, template_name: str, context: dict, cc_emails=None, attachments=None):
        """
        Renders a Jinja2 template and sends the email using the existing send method.
        Supports CC and Attachments.
        """
        try:
            logger.info(f"Rendering template '{template_name}' for {to_email}...")
            template = self.env.get_template(template_name)
            html_content = template.render(**context)
            
            # Delegate to the raw send method
            return self.send(to_email, subject, html_content, cc_emails=cc_emails, attachments=attachments)
        except Exception as e:
            logger.error(f"Template Rendering Failed: {e}")
            return False

    def send(self, to_emails, subject: str, html_content: str, cc_emails=None, attachments=None):
        if not self.api_key:
            logger.info(f"[MOCK EMAIL] To: {to_emails} | Subject: {subject}")
            # logger.info(f"[CONTENT] {html_content[:100]}...") # Optional debug
            return True   

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
                
                if att_list: params["attachments"] = att_list

            resp = resend.Emails.send(params)
            logger.info(f"Email Sent ID: {resp.get('id')}")
            return True

        except Exception as e:
            logger.error(f"EMAIL FAILED: {str(e)}")
            return False

email_service = EmailService()