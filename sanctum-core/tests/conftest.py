import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, get_db
from app.models import User
from app.auth import create_access_token
import os
from dotenv import load_dotenv

load_dotenv()

# USE REAL POSTGRES, BUT A TEST DATABASE
# Fallback to local dev creds if not in env
DB_URL = os.getenv("TEST_DATABASE_URL", "postgresql://sanctum_admin:local_dev_password@localhost/sanctum_test")

engine = create_engine(DB_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    # 1. Create Tables
    Base.metadata.create_all(bind=engine)
    
    # 2. Bind Session
    session = TestingSessionLocal()
    yield session
    
    # 3. Teardown
    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def admin_token_headers(db):
    email = "testadmin@sanctum.com"
    admin = User(
        email=email,
        password_hash="fakehash",
        full_name="Test Admin",
        role="admin",
        access_scope="global"
    )
    db.add(admin)
    db.commit()
    
    token = create_access_token(data={"sub": email, "role": "admin", "scope": "global"})
    return {"Authorization": f"Bearer {token}"}