"""Live-endpoint query-budget regression test for GET /accounts/{id}.

Ensures the CRM account detail endpoint emits a bounded number of SQL
queries and returns the expected payload shape.  Catches N+1 /
cartesian-explosion regressions (cf. #2980) at CI time.
"""

from __future__ import annotations

import os
import tempfile

_db_path = os.path.join(tempfile.gettempdir(), f"test_query_budget_{os.getpid()}.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("OIDC_ISSUER", "https://auth.example.test")
os.environ.setdefault("OIDC_CLIENT_ID", "sanctum-core")
os.environ.setdefault("OIDC_CLIENT_SECRET", "test-secret")
os.environ.setdefault("OIDC_REDIRECT_URI", "http://localhost/callback")

import uuid
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.sql import expression
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.ext.compiler import compiles

# SQLite PG-type compatibility
@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return compiler.visit_JSON(element)

@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(element, compiler, **kw):
    from sqlalchemy import String
    return compiler.visit_VARCHAR(String())


from app.main import app
from app.database import engine
from app import models
from sqlalchemy.orm import Session
from tests.helpers.query_counter import QueryCounter


# Register PG-compatible functions with SQLite connections.
@event.listens_for(engine, "connect")
def _sqlite_connect(dbapi_connection, connection_record):
    """Register PG-compatible functions on each new SQLite connection."""
    dbapi_connection.create_function("gen_random_uuid", 0, lambda: uuid.uuid4().hex)


# Build SQLite-compatible DDL: strip PG-specific server defaults before
# calling create_all.  The @compiles hooks above handle type rendering.
_ORIGINAL_DEFAULTS: dict = {}


def _patch_for_sqlite():
    """Walk all model tables and replace PG-specific server_defaults."""
    from sqlalchemy.schema import DefaultClause
    for table in models.Base.metadata.sorted_tables:
        for col in table.columns:
            sd = col.server_default
            if sd is not None and hasattr(sd, "arg"):
                raw = str(sd.arg)
                if "::jsonb" in raw:
                    _ORIGINAL_DEFAULTS[col] = sd
                    col.server_default = DefaultClause(expression.text(raw.replace("::jsonb", "")))


def _restore_defaults():
    for col, sd in _ORIGINAL_DEFAULTS.items():
        col.server_default = sd
    _ORIGINAL_DEFAULTS.clear()


def _seed_fixture(db: Session, account_id: uuid.UUID) -> None:
    """Seed a realistic Account with related data for query-budget tests."""
    from app.models import Account, Contact, Ticket, Asset, Invoice, Deal

    acct = Account(id=account_id, name="Test Corp", type="client", brand_affinity="ds", status="active")
    db.add(acct)
    db.flush()

    for i in range(10):
        db.add(
            Contact(
                account_id=account_id,
                first_name=f"Contact{i}",
                last_name="Test",
                email=f"contact{i}@test.com",
            )
        )
    db.flush()

    db.add(Deal(title="Test Deal", amount=10000, stage="proposal", account_id=account_id))
    db.flush()

    for i in range(2):
        db.add(Invoice(account_id=account_id, total_amount=500))
    db.flush()

    for i in range(5):
        db.add(Asset(name=f"Asset{i}", account_id=account_id, asset_type="hardware"))
    db.flush()

    for i in range(50):
        db.add(
            Ticket(
                subject=f"Ticket {i}",
                account_id=account_id,
                status="new",
                ticket_type="support",
            )
        )
    db.flush()


class TestAccountDetailQueryBudget:
    """Query-budget regression tests for the CRM account detail endpoint."""

    @classmethod
    def setup_class(cls):
        _patch_for_sqlite()
        models.Base.metadata.create_all(bind=engine)
        _restore_defaults()

    @classmethod
    def teardown_class(cls):
        models.Base.metadata.drop_all(bind=engine)

    def _fresh_seed(self) -> uuid.UUID:
        """Drop all rows and re-seed, returning the created account UUID."""
        with Session(engine) as session:
            for table in reversed(models.Base.metadata.sorted_tables):
                session.execute(table.delete())
            session.commit()
        aid = uuid.uuid4()
        with Session(engine) as session:
            _seed_fixture(session, aid)
            session.commit()
        return aid

    def test_query_count_below_ceiling(self):
        """GET /accounts/{id} must emit fewer than 20 SQL queries."""
        aid = self._fresh_seed()
        with QueryCounter(engine) as counter:
            response = TestClient(app).get(f"/accounts/{aid}")
        assert response.status_code == 200
        assert counter.count < 20, (
            f"Query count {counter.count} exceeds ceiling 20. "
            "If you added a new eager-load, ensure it uses selectinload "
            "and update this ceiling accordingly."
        )

    def test_payload_shape(self):
        """Response must contain expected keys and sub-object counts."""
        aid = self._fresh_seed()
        response = TestClient(app).get(f"/accounts/{aid}")
        assert response.status_code == 200
        body = response.json()
        assert "id" in body
        assert "name" in body
        assert len(body.get("contacts", [])) == 10
        assert len(body.get("deals", [])) == 1
        assert len(body.get("invoices", [])) == 2
        assert len(body.get("assets", [])) == 5
