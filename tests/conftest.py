import os
import pytest
from dotenv import load_dotenv
from client import SanctumClient # From your tests/client.py

# Load from the correct path
load_dotenv("sanctum-core/.env")

@pytest.fixture(scope="session")
def api():
    """Your root API client (Hits the live/dev server)"""
    base = os.getenv("API_BASE", "http://localhost:8000")
    email = os.getenv("SANCTUM_EMAIL", "peter@digitalsanctum.com.au")

    password = os.getenv("SANCTUM_PASSWORD")
    totp_secret = os.getenv("SANCTUM_TOTP_SECRET")

    client = SanctumClient(base)
    client.authenticate(email, password, totp_secret)
    return client

# Optional: Add this if you want to run the old internal tests too
@pytest.fixture
def test_app():
    """Internal FastAPI TestClient (Boots the app in-memory)"""
    from app.main import app
    from fastapi.testclient import TestClient
    return TestClient(app)
