import pytest
import uuid
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, get_db
from app.models import User
from app.auth import create_access_token

# 1. In-Memory Database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
    dbapi_connection.create_function("gen_random_uuid", 0, lambda: str(uuid.uuid4()))

# Global Session Maker
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

@pytest.fixture(scope="function")
def db():
    # Create tables
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    # Drop tables
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db):
    # Dependency Override
    def override_get_db():
        try:
            yield db
        finally:
            pass # Do not close here, let fixture handle it

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def admin_token_headers(client, db):
    email = "testadmin@sanctum.com"
    
    # Create user directly in the session
    admin = User(
        email=email,
        password_hash="fakehash",
        full_name="Test Admin",
        role="admin",
        access_scope="global"
    )
    db.add(admin)
    db.commit()
    
    # No refresh needed, just grab data
    token = create_access_token(data={"sub": email, "role": "admin", "scope": "global"})
    return {"Authorization": f"Bearer {token}"}