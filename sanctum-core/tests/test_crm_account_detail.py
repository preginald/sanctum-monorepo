"""Regression tests for #2980 — HQ Dossier OOM on GET /accounts/{id}.

Root cause (#2979): `AccountDetail.tickets: List[TicketResponse]` combined
with a `joinedload` chain `tickets -> time_entries -> user` produced a
Cartesian cross-JOIN against 5 other eagerly-loaded collections. For
Digital Sanctum HQ (2000+ tickets) the response exploded and crashed the
API worker with OOM.

Fix:
    - `crm.py`: drop the `tickets` joinedload entirely, swap the remaining
      five collections from `joinedload` to `selectinload`.
    - `portal.py`: remove `tickets: List[TicketResponse]` from `AccountDetail`.

These tests are **schema-shape** regressions — they assert the fix is
present at the schema and route-options layer so the response contract
cannot regress without someone also rewriting the assertions here.

This follows the unit-test pattern used by `test_billable_item_gate.py`:
no TestClient, no DB fixtures, no OIDC stubbing — pure logic assertions
against the imported modules.
"""

from __future__ import annotations

import os

# Mirror the env-var bootstrap from conftest.py — required before any
# `app.*` import because app.database evaluates DATABASE_URL at module scope.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("OIDC_ISSUER", "https://auth.example.test")
os.environ.setdefault("OIDC_CLIENT_ID", "sanctum-core")
os.environ.setdefault("OIDC_CLIENT_SECRET", "test-secret")
os.environ.setdefault("OIDC_REDIRECT_URI", "http://localhost/callback")


class TestAccountDetailSchemaShape:
    """The `AccountDetail` schema must not expose a `tickets` field.

    This is the primary contract that breaks the OOM chain. If this field
    comes back, the cross-JOIN explosion on HQ resurfaces.
    """

    def test_account_detail_has_no_tickets_field(self):
        from app.schemas.portal import AccountDetail

        assert "tickets" not in AccountDetail.model_fields, (
            "AccountDetail.tickets was removed in #2980 to prevent OOM on "
            "HQ Dossier. Reintroducing it will re-trigger the original bug. "
            "Frontends should call GET /tickets?account_id={id} instead."
        )

    def test_account_detail_retains_expected_collections(self):
        """Guard against accidental schema mass-drop."""
        from app.schemas.portal import AccountDetail

        expected = {
            "contacts",
            "deals",
            "projects",
            "invoices",
            "assets",
            "audit_data",
        }
        missing = expected - set(AccountDetail.model_fields.keys())
        assert not missing, f"AccountDetail lost fields: {missing}"


class TestAccountDetailEagerLoadStrategy:
    """`get_account_detail` must not re-introduce the cross-JOIN pattern.

    We inspect the source of the route handler and assert both that the
    `tickets` eager-load is gone and that the remaining collections use
    `selectinload` (separate queries, no Cartesian blow-up) rather than
    `joinedload` (single query with JOINs).
    """

    def test_get_account_detail_does_not_joinedload_tickets(self):
        import inspect

        from app.routers import crm

        src = inspect.getsource(crm.get_account_detail)
        assert "Account.tickets" not in src, (
            "get_account_detail must not eager-load Account.tickets — "
            "that path caused OOM on HQ (#2980). Tickets are fetched via "
            "GET /tickets?account_id= from the frontend."
        )
        # The `time_entries -> user` chain was the multiplier; make sure
        # nobody reintroduces it inside this handler.
        assert "Ticket.time_entries" not in src, (
            "Ticket.time_entries must not be eagerly joined in "
            "get_account_detail (#2980)."
        )

    def test_get_account_detail_uses_selectinload(self):
        import inspect

        from app.routers import crm

        src = inspect.getsource(crm.get_account_detail)
        assert "selectinload(models.Account.contacts)" in src
        assert "selectinload(models.Account.deals)" in src
        assert "selectinload(models.Account.projects)" in src
        assert "selectinload(models.Account.invoices)" in src
        assert "selectinload(models.Account.assets)" in src

    def test_get_account_detail_removed_set_committed_value_loop(self):
        """The `set_committed_value` loop became obsolete once the tickets
        eager-load was dropped. Guard against it being reinstated."""
        import inspect

        from app.routers import crm

        src = inspect.getsource(crm.get_account_detail)
        assert "set_committed_value" not in src, (
            "set_committed_value loop was removed in #2980 — the tickets "
            "relationship is no longer eagerly loaded, so the suppression "
            "loop is unnecessary."
        )
