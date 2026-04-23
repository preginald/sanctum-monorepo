"""Regression tests for #2980 — `GET /tickets?account_id=` filter + client-scope guard.

The HQ Dossier OOM fix (#2980) moves the tickets list off `AccountDetail`
and onto the existing `GET /tickets` endpoint via a new `account_id` query
parameter. The frontend (`ClientDetail.jsx`) now calls
`/tickets?account_id={id}&limit=50`.

This introduces a new cross-account scope surface that MUST NOT leak:
a client user passing `account_id=<other>` must stay scoped to their own
account — their own-account filter wins unconditionally.

These tests replicate the filter-assembly logic from `tickets.py` in
isolation (matching the pattern of `test_billable_item_gate.py`), so the
guard can be verified without a live DB or TestClient.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional
from uuid import UUID, uuid4

# Bootstrap required env for any downstream app.* import the suite may pull.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")


@dataclass
class FakeUser:
    """Mirrors the subset of `models.User` fields consulted by the filter."""
    role: str
    access_scope: str
    account_id: UUID


def assemble_ticket_filters(
    *,
    current_user: FakeUser,
    status: Optional[str] = None,
    account_id: Optional[UUID] = None,
) -> dict:
    """
    Replicate the filter assembly from tickets.py `get_tickets` (lines 60-75
    post-#2980). Returns a plain dict capturing the logical filter decisions:

        {
            "scope_account_id": UUID | None,
            "brand_affinity_in": list | None,
            "status": str | None,
        }

    The "scope_account_id" key is what drives `account_id` filtering — it
    is the value actually appended to the SQLAlchemy `filters` list.
    """
    result: dict = {
        "scope_account_id": None,
        "brand_affinity_in": None,
        "status": None,
    }

    if current_user.access_scope == "nt_only":
        result["brand_affinity_in"] = ["nt", "both"]
    elif current_user.access_scope == "ds_only":
        result["brand_affinity_in"] = ["ds", "both"]

    # Client-scope filter — wins unconditionally.
    if current_user.role == "client":
        result["scope_account_id"] = current_user.account_id

    # Scoped filter — ignored for client role (guarded).
    if account_id and current_user.role != "client":
        result["scope_account_id"] = account_id

    if status:
        result["status"] = status

    return result


class TestInternalUserAccountFilter:
    """Internal users (admin/tech) can scope by account_id."""

    def test_admin_passing_account_id_filters_to_that_account(self):
        target = uuid4()
        admin = FakeUser(role="admin", access_scope="global", account_id=uuid4())

        filters = assemble_ticket_filters(current_user=admin, account_id=target)

        assert filters["scope_account_id"] == target

    def test_tech_passing_account_id_filters_to_that_account(self):
        target = uuid4()
        tech = FakeUser(role="tech", access_scope="global", account_id=uuid4())

        filters = assemble_ticket_filters(current_user=tech, account_id=target)

        assert filters["scope_account_id"] == target

    def test_admin_without_account_id_is_unscoped(self):
        admin = FakeUser(role="admin", access_scope="global", account_id=uuid4())

        filters = assemble_ticket_filters(current_user=admin, account_id=None)

        assert filters["scope_account_id"] is None

    def test_brand_scope_still_applies_for_ds_only(self):
        admin = FakeUser(role="admin", access_scope="ds_only", account_id=uuid4())
        target = uuid4()

        filters = assemble_ticket_filters(current_user=admin, account_id=target)

        assert filters["scope_account_id"] == target
        assert filters["brand_affinity_in"] == ["ds", "both"]


class TestClientScopeGuard:
    """Client users MUST remain scoped to their own account regardless of
    what `account_id` they pass. This is the non-negotiable from #2979."""

    def test_client_passing_other_account_id_is_silently_ignored(self):
        client_account = uuid4()
        other_account = uuid4()
        client = FakeUser(
            role="client", access_scope="restricted", account_id=client_account,
        )

        filters = assemble_ticket_filters(
            current_user=client, account_id=other_account,
        )

        # The client sees only their own account — the `other_account`
        # query param is silently ignored, never reaches the filter.
        assert filters["scope_account_id"] == client_account
        assert filters["scope_account_id"] != other_account

    def test_client_passing_own_account_id_is_still_own_scope(self):
        client_account = uuid4()
        client = FakeUser(
            role="client", access_scope="restricted", account_id=client_account,
        )

        filters = assemble_ticket_filters(
            current_user=client, account_id=client_account,
        )

        assert filters["scope_account_id"] == client_account

    def test_client_with_no_account_id_is_scoped_to_own_account(self):
        client_account = uuid4()
        client = FakeUser(
            role="client", access_scope="restricted", account_id=client_account,
        )

        filters = assemble_ticket_filters(current_user=client, account_id=None)

        assert filters["scope_account_id"] == client_account

    def test_client_cannot_escape_scope_via_nt_or_ds_hop(self):
        """Even with an exotic access_scope combo, the role=='client' guard
        still wins over account_id."""
        client_account = uuid4()
        other_account = uuid4()
        client = FakeUser(
            role="client", access_scope="nt_only", account_id=client_account,
        )

        filters = assemble_ticket_filters(
            current_user=client, account_id=other_account,
        )

        assert filters["scope_account_id"] == client_account


class TestFilterOrdering:
    """Guard against future refactors that reorder the two filters and
    accidentally let the `account_id` param override the client-scope."""

    def test_guard_precedes_account_id_filter_in_source(self):
        """Read the handler source and assert the client-scope filter is
        written BEFORE the account_id filter. Ordering matters because if
        a future refactor swaps them and drops the `!= 'client'` guard, the
        client-scope filter gets overwritten."""
        import inspect

        from app.routers import tickets

        src = inspect.getsource(tickets.get_tickets)
        client_scope_idx = src.find(
            "current_user.account_id",
        )
        account_id_filter_idx = src.find(
            "current_user.role != 'client'",
        )
        assert client_scope_idx > 0, "client-scope filter missing"
        assert account_id_filter_idx > 0, "account_id guard missing"
        assert client_scope_idx < account_id_filter_idx, (
            "Client-scope filter must appear BEFORE the account_id filter "
            "so the role=='client' guard cannot be bypassed."
        )
