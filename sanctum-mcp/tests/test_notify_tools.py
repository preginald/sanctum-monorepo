"""Tests for MCP notify tools (tools/notify.py) against a mocked Notify upstream.

Each tool is exercised by injecting an httpx.AsyncClient backed by
httpx.MockTransport into client_notify._client, invoking the tool's async
function directly (no MCP client), and asserting:

  - the HTTP call hit the expected path + method
  - query params / request body match what the tool built
  - the stubbed response round-trips back through json.dumps

Docstring-level assertions also lock in the spam-keyword shadow-accept
warning for notify_send and notify_send_batch (Observation #1).
"""

import json
import os
import sys

import httpx
import pytest

# Ensure sanctum-mcp root is on sys.path for bare imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import client_notify  # noqa: E402
from tools import notify  # noqa: E402


# ── Fixtures ──────────────────────────────────────────────────────────


@pytest.fixture
def captured():
    """Shared dict each test uses to record the intercepted request."""
    return {}


@pytest.fixture
def mock_client(captured, monkeypatch):
    """Factory that installs an httpx.MockTransport-backed client on
    client_notify._client and returns a helper to register per-test
    handlers.

    Usage:
        def test_x(mock_client, captured):
            mock_client(lambda req: httpx.Response(200, json={"ok": True}))
            ...
    """
    def _install(handler):
        def _wrapped(request: httpx.Request) -> httpx.Response:
            # Record the request so assertions can inspect it
            captured["method"] = request.method
            captured["path"] = request.url.path
            captured["params"] = dict(request.url.params)
            captured["headers"] = dict(request.headers)
            body = request.content
            if body:
                try:
                    captured["json"] = json.loads(body)
                except ValueError:
                    captured["body"] = body
            return handler(request)

        transport = httpx.MockTransport(_wrapped)
        fake = httpx.AsyncClient(
            base_url="http://notify.test",
            transport=transport,
        )
        monkeypatch.setattr(client_notify, "_client", fake)
        return fake

    return _install


# ── Dispatch tools ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_send_posts_payload_and_roundtrips(mock_client, captured):
    stub = {"id": "00000000-0000-0000-0000-000000000001", "status": "queued"}
    mock_client(lambda req: httpx.Response(202, json=stub))

    raw = await notify.notify_send(
        to="user@example.com",
        template="welcome",
        data={"name": "Alice"},
    )

    assert captured["method"] == "POST"
    assert captured["path"] == "/notify"
    assert captured["json"] == {
        "to": "user@example.com",
        "template": "welcome",
        "data": {"name": "Alice"},
        "channel": "email",
    }
    assert json.loads(raw) == stub


@pytest.mark.asyncio
async def test_notify_send_batch_posts_wrapped_list(mock_client, captured):
    stub = {
        "batch_id": "batch-1",
        "notification_ids": ["id-1", "id-2"],
        "count": 2,
    }
    mock_client(lambda req: httpx.Response(202, json=stub))

    items = [
        {"to": "a@example.com", "template": "welcome", "data": {}, "channel": "email"},
        {"to": "b@example.com", "template": "welcome", "data": {}, "channel": "email"},
    ]
    raw = await notify.notify_send_batch(notifications=items)

    assert captured["method"] == "POST"
    assert captured["path"] == "/notify/batch"
    assert captured["json"] == {"notifications": items}
    assert json.loads(raw) == stub


# ── Query tools ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_list_forwards_filter_params(mock_client, captured):
    stub = [{"id": "n1", "status": "sent"}]
    mock_client(lambda req: httpx.Response(200, json=stub))

    raw = await notify.notify_list(
        status="sent",
        template="welcome",
        since="2026-01-01T00:00:00Z",
        recipient="user@example.com",
        tenant="acme",
        limit=10,
        offset=5,
    )

    assert captured["method"] == "GET"
    assert captured["path"] == "/notify"
    assert captured["params"] == {
        "status": "sent",
        "template": "welcome",
        "since": "2026-01-01T00:00:00Z",
        "recipient": "user@example.com",
        "tenant": "acme",
        "limit": "10",
        "offset": "5",
    }
    assert json.loads(raw) == stub


@pytest.mark.asyncio
async def test_notify_list_omits_none_filters(mock_client, captured):
    """Optional filters set to None must not be sent as 'None' strings."""
    mock_client(lambda req: httpx.Response(200, json=[]))

    await notify.notify_list()

    # Only limit/offset with defaults
    assert captured["params"] == {"limit": "50", "offset": "0"}


@pytest.mark.asyncio
async def test_notify_show_hits_path(mock_client, captured):
    stub = {"id": "abc-123", "status": "sent"}
    mock_client(lambda req: httpx.Response(200, json=stub))

    raw = await notify.notify_show("abc-123")

    assert captured["method"] == "GET"
    assert captured["path"] == "/notify/abc-123"
    assert json.loads(raw) == stub


@pytest.mark.asyncio
async def test_notify_list_dead_letter_forwards_pagination(mock_client, captured):
    stub = [{"id": "dl-1", "status": "dead_letter"}]
    mock_client(lambda req: httpx.Response(200, json=stub))

    raw = await notify.notify_list_dead_letter(limit=25, offset=10)

    assert captured["method"] == "GET"
    assert captured["path"] == "/notify/dead-letter"
    assert captured["params"] == {"limit": "25", "offset": "10"}
    assert json.loads(raw) == stub


@pytest.mark.asyncio
async def test_notify_retry_posts_to_retry_path(mock_client, captured):
    stub = {"id": "abc-123", "status": "queued"}
    mock_client(lambda req: httpx.Response(200, json=stub))

    raw = await notify.notify_retry("abc-123")

    assert captured["method"] == "POST"
    assert captured["path"] == "/notify/abc-123/retry"
    assert json.loads(raw) == stub


@pytest.mark.asyncio
async def test_notify_list_tenants_hits_admin_path(mock_client, captured):
    stub = [{"name": "acme", "count": 42}]
    mock_client(lambda req: httpx.Response(200, json=stub))

    raw = await notify.notify_list_tenants()

    assert captured["method"] == "GET"
    assert captured["path"] == "/notify/tenants"
    assert json.loads(raw) == stub


# ── Suppression tools ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_suppress_create_posts_payload(mock_client, captured):
    stub = {"email": "bad@example.com", "reason": "bounce", "source": "ses:hard"}
    mock_client(lambda req: httpx.Response(201, json=stub))

    raw = await notify.notify_suppress_create(
        email="bad@example.com",
        reason="bounce",
        source="ses:hard",
    )

    assert captured["method"] == "POST"
    assert captured["path"] == "/v1/suppressions"
    assert captured["json"] == {
        "email": "bad@example.com",
        "reason": "bounce",
        "source": "ses:hard",
    }
    assert json.loads(raw) == stub


@pytest.mark.asyncio
async def test_notify_suppress_create_omits_optional_source(mock_client, captured):
    mock_client(lambda req: httpx.Response(201, json={"email": "x@x.com"}))

    await notify.notify_suppress_create(email="x@x.com")

    assert captured["json"] == {"email": "x@x.com", "reason": "manual"}
    assert "source" not in captured["json"]


@pytest.mark.asyncio
async def test_notify_suppress_delete_hits_email_path(mock_client, captured):
    stub = {"deleted": True}
    mock_client(lambda req: httpx.Response(200, json=stub))

    raw = await notify.notify_suppress_delete("user@example.com")

    assert captured["method"] == "DELETE"
    assert captured["path"] == "/v1/suppressions/user@example.com"
    assert json.loads(raw) == stub


@pytest.mark.asyncio
async def test_notify_suppress_list_forwards_pagination(mock_client, captured):
    stub = [{"email": "x@x.com", "reason": "manual"}]
    mock_client(lambda req: httpx.Response(200, json=stub))

    raw = await notify.notify_suppress_list(skip=20, limit=100)

    assert captured["method"] == "GET"
    assert captured["path"] == "/v1/suppressions"
    assert captured["params"] == {"skip": "20", "limit": "100"}
    assert json.loads(raw) == stub


# ── Docstring guardrails (Observation #1 — spam shadow-accept) ────────


SPAM_KEYWORDS = ("viagra", "crypto", "bitcoin", "buy now", "casino", "lottery")


def test_notify_send_docstring_warns_about_spam_shadow_accept():
    """Lock in the spam-keyword warning so it can't be silently removed."""
    doc = (notify.notify_send.__doc__ or "").lower()
    assert "shadow" in doc, "notify_send docstring must warn about shadow-accept"
    assert "spam" in doc, "notify_send docstring must mention spam filter"
    for kw in SPAM_KEYWORDS:
        assert kw in doc, f"notify_send docstring must list spam keyword {kw!r}"


def test_notify_send_batch_docstring_warns_about_spam_shadow_accept():
    """Lock in the spam-keyword warning so it can't be silently removed."""
    doc = (notify.notify_send_batch.__doc__ or "").lower()
    assert "shadow" in doc, "notify_send_batch docstring must warn about shadow-accept"
    assert "spam" in doc, "notify_send_batch docstring must mention spam filter"
    for kw in SPAM_KEYWORDS:
        assert kw in doc, f"notify_send_batch docstring must list spam keyword {kw!r}"
