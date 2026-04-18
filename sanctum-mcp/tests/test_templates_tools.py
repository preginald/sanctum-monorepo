"""Tests for MCP template section & item CRUD tools (tools/templates.py).

Uses the `monkeypatch` + `FakeClient` pattern from
`tests/test_identity_middleware.py` to swap `client._client` for a stub that
captures the outgoing HTTP method, path, and JSON body. Each per-tool test
invokes the tool function directly and asserts:

  - the HTTP method and path match the expected Core API route
  - for create/update: the captured JSON body equals the exact payload
    (with None-valued fields filtered out)
  - for update/delete: `template_id` is NOT present in the URL
  - for delete: the new 204 guard in client.delete() returns
    `{"status": "deleted"}` and the tool round-trips it through json.dumps
  - every tool's return value is a str that round-trips through json.loads

A dedicated test also exercises the 204 guard directly on client.delete()
to lock in the contract for any future delete endpoint returning 204.
"""

import json as json_lib
import os
import sys

import pytest

# Ensure sanctum-mcp root is on sys.path for bare imports (client, telemetry)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ── FakeClient helpers ────────────────────────────────────────────────


def _make_fake_client(captured, status_code=200, body=b'{"ok": true}'):
    """Return a FakeClient class that captures the request and returns a
    canned response with the given status_code and raw body."""

    class FakeClient:
        is_closed = False

        async def request(self, method, path, **kwargs):
            captured["method"] = method
            captured["path"] = path
            captured["json"] = kwargs.get("json")

            class R:
                pass

            r = R()
            r.status_code = status_code
            r.content = body
            r.request = type("Req", (), {"url": path})()

            def _json(_self=r):
                if not _self.content:
                    raise ValueError("no body")
                return json_lib.loads(_self.content.decode())

            def _raise(_self=r):
                pass

            r.json = _json
            r.raise_for_status = _raise
            r.headers = {}
            return r

    return FakeClient()


# ── template_section_create ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_template_section_create_calls_correct_endpoint(monkeypatch):
    import client
    from tools.templates import template_section_create

    captured = {}
    monkeypatch.setattr(
        client,
        "_client",
        _make_fake_client(captured, status_code=201, body=b'{"id": "sec-1"}'),
    )

    result = await template_section_create(
        template_id="tpl-uuid",
        name="Phase 1",
        description="Kickoff",
        sequence=1,
    )

    assert captured["method"] == "POST"
    assert captured["path"] == "/templates/tpl-uuid/sections"
    assert captured["json"] == {
        "name": "Phase 1",
        "description": "Kickoff",
        "sequence": 1,
    }
    # Tool returns a JSON string that round-trips
    parsed = json_lib.loads(result)
    assert parsed == {"id": "sec-1"}


# ── template_section_update ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_template_section_update_calls_correct_endpoint(monkeypatch):
    import client
    from tools.templates import template_section_update

    captured = {}
    monkeypatch.setattr(
        client,
        "_client",
        _make_fake_client(captured, status_code=200, body=b'{"id": "sec-1"}'),
    )

    result = await template_section_update(
        template_id="tpl-uuid",
        section_id="sec-uuid",
        name="Phase 1 Renamed",
        # description and sequence left as None so they are filtered out
    )

    assert captured["method"] == "PUT"
    assert captured["path"] == "/templates/sections/sec-uuid"
    # template_id must NOT appear in the URL
    assert "tpl-uuid" not in captured["path"]
    # None-valued fields filtered out of payload
    assert captured["json"] == {"name": "Phase 1 Renamed"}
    assert json_lib.loads(result) == {"id": "sec-1"}


# ── template_section_delete ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_template_section_delete_calls_correct_endpoint(monkeypatch):
    import client
    from tools.templates import template_section_delete

    captured = {}
    # 204 No Content with empty body — exercises the new client.delete() guard
    monkeypatch.setattr(
        client,
        "_client",
        _make_fake_client(captured, status_code=204, body=b""),
    )

    result = await template_section_delete("tpl-uuid", "sec-uuid")

    assert captured["method"] == "DELETE"
    assert captured["path"] == "/templates/sections/sec-uuid"
    assert "tpl-uuid" not in captured["path"]
    # 204 guard should produce {"status": "deleted"}
    assert json_lib.loads(result) == {"status": "deleted"}


# ── template_item_create ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_template_item_create_calls_correct_endpoint(monkeypatch):
    import client
    from tools.templates import template_item_create

    captured = {}
    monkeypatch.setattr(
        client,
        "_client",
        _make_fake_client(captured, status_code=201, body=b'{"id": "itm-1"}'),
    )

    result = await template_item_create(
        template_id="tpl-uuid",
        section_id="sec-uuid",
        subject="Wire CLI integration for {service_name}",
        description="Scaffold the CLI command module",
        item_type="task",
        priority="normal",
        sequence=3,
        config={"tags": ["cli"]},
    )

    assert captured["method"] == "POST"
    assert captured["path"] == "/templates/sections/sec-uuid/items"
    assert "tpl-uuid" not in captured["path"]
    assert captured["json"] == {
        "subject": "Wire CLI integration for {service_name}",
        "description": "Scaffold the CLI command module",
        "item_type": "task",
        "priority": "normal",
        "sequence": 3,
        "config": {"tags": ["cli"]},
    }
    assert json_lib.loads(result) == {"id": "itm-1"}


# ── template_item_update ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_template_item_update_calls_correct_endpoint(monkeypatch):
    import client
    from tools.templates import template_item_update

    captured = {}
    monkeypatch.setattr(
        client,
        "_client",
        _make_fake_client(captured, status_code=200, body=b'{"id": "itm-1"}'),
    )

    result = await template_item_update(
        template_id="tpl-uuid",
        item_id="itm-uuid",
        priority="high",
        # subject, description, item_type, sequence, config left as None
    )

    assert captured["method"] == "PUT"
    assert captured["path"] == "/templates/items/itm-uuid"
    assert "tpl-uuid" not in captured["path"]
    assert captured["json"] == {"priority": "high"}
    assert json_lib.loads(result) == {"id": "itm-1"}


# ── template_item_delete ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_template_item_delete_calls_correct_endpoint(monkeypatch):
    import client
    from tools.templates import template_item_delete

    captured = {}
    monkeypatch.setattr(
        client,
        "_client",
        _make_fake_client(captured, status_code=204, body=b""),
    )

    result = await template_item_delete("tpl-uuid", "itm-uuid")

    assert captured["method"] == "DELETE"
    assert captured["path"] == "/templates/items/itm-uuid"
    assert "tpl-uuid" not in captured["path"]
    assert json_lib.loads(result) == {"status": "deleted"}


# ── client.delete() 204 guard ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_client_delete_handles_204_empty_body(monkeypatch):
    """Direct contract test on client.delete(): a 204 response with an empty
    body must NOT raise JSONDecodeError — the guard returns a sentinel dict.
    """
    import client

    captured = {}
    monkeypatch.setattr(
        client,
        "_client",
        _make_fake_client(captured, status_code=204, body=b""),
    )

    result = await client.delete("/templates/sections/some-uuid")

    assert captured["method"] == "DELETE"
    assert result == {"status": "deleted"}
