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
        self.system_email = "notifications@digitalsanctum.com.au"
        self.admin_email = "hello@digitalsanctum.com.au"

    def send(self, to_emails, subject: str, html_content: str, cc_emails=None, attachments=None):
        """
        Sends an email via Resend.
        to_emails: str or list
        cc_emails: str or list
        attachments: list of dicts [{'filename': 'x.pdf', 'content': bytes}] OR list of file paths? 
                     Resend python SDK handles file paths if we read them.
        """
        if not self.api_key:
            print(f"[Mock Email] To: {to_emails} | Subject: {subject}")
            return False

        # Normalize to lists
        if isinstance(to_emails, str): to_emails = [to_emails]
        if isinstance(cc_emails, str): cc_emails = [cc_emails]

        try:
            params = {
                "from": f"Sanctum Core <{self.system_email}>",
                "to": to_emails,
                "subject": subject,
                "html": html_content,
            }
            
            if cc_emails:
                params["cc"] = cc_emails

            # Handle Attachments (Path based)
            if attachments:
                att_list = []
                for path in attachments:
                    # In a real scenario we read the file bytes, but Resend might accept paths?
                    # Resend Python SDK expects: 
                    # "attachments": [{"filename": "invoice.pdf", "content": [list of ints or bytes]}]
                    # We will read the file manually here.
                    try:
                        with open(path, "rb") as f:
                            content = list(f.read()) # Resend expects list of integers
                            filename = os.path.basename(path)
                            att_list.append({"filename": filename, "content": content})
                    except Exception as e:
                        print(f"Failed to attach {path}: {e}")
                
                if att_list:
                    params["attachments"] = att_list

            email = resend.Emails.send(params)
            print(f"Email sent: {email}")
            return True
        except Exception as e:
            print(f"Email Error: {str(e)}")
            return False

email_service = EmailService()