import requests
import pyotp

class SanctumClient:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()

    def authenticate(self, email, password, totp_secret=None):
        # OAuth2 password grant format
        payload = {"username": email, "password": password}
        
        # Step 1: Login
        res = self.session.post(f"{self.base_url}/token", data=payload)
        data = res.json()

        # Step 2: 2FA Handling
        if data.get("detail") == "2FA_REQUIRED":
            if not totp_secret:
                raise ValueError("2FA required but no secret provided in .env")
            payload["otp"] = pyotp.TOTP(totp_secret).now()
            res = self.session.post(f"{self.base_url}/token", data=payload)
            data = res.json()

        token = data.get("access_token")
        if not token:
            raise Exception(f"Auth failed: {data}")
            
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        return data
