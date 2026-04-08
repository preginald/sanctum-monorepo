"""Tests for X-Sanctum-Agent identity middleware and ContextVar token injection."""

import os
import sys
import pytest

# Ensure sanctum-mcp root is on sys.path for bare imports (client, telemetry)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ── client.py ContextVar tests ─────────────────────────────────────────

class TestClientContextVar:
    """CURRENT_API_TOKEN ContextVar in client.py."""

    def test_default_is_api_token(self):
        from client import API_TOKEN, CURRENT_API_TOKEN
        assert CURRENT_API_TOKEN.get() == API_TOKEN

    def test_contextvar_override(self):
        from client import API_TOKEN, CURRENT_API_TOKEN
        token = CURRENT_API_TOKEN.set("override_token_123")
        try:
            assert CURRENT_API_TOKEN.get() == "override_token_123"
        finally:
            CURRENT_API_TOKEN.reset(token)
        assert CURRENT_API_TOKEN.get() == API_TOKEN

    @pytest.mark.asyncio
    async def test_request_uses_contextvar(self, monkeypatch):
        """_request() should inject the ContextVar token, not the module-level constant."""
        from client import CURRENT_API_TOKEN
        import client

        captured_headers = {}

        async def fake_request(method, url, **kwargs):
            captured_headers.update(kwargs.get("headers", {}))

            class FakeResponse:
                status_code = 200
                content = b'{"ok": true}'
                request = type("R", (), {"url": url})()
                def json(self):
                    return {"ok": True}
                def raise_for_status(self):
                    pass
            return FakeResponse()

        # Patch the httpx client's request method
        class FakeClient:
            is_closed = False
            async def request(self, method, path, **kwargs):
                return await fake_request(method, path, **kwargs)

        monkeypatch.setattr(client, "_client", FakeClient())

        # Set a custom token via ContextVar
        cv_token = CURRENT_API_TOKEN.set("custom_agent_token")
        try:
            await client.get("/test")
        finally:
            CURRENT_API_TOKEN.reset(cv_token)

        assert captured_headers["Authorization"] == "Bearer custom_agent_token"


# ── telemetry.py ContextVar tests ──────────────────────────────────────

class TestTelemetryContextVar:
    """CURRENT_AGENT_PERSONA ContextVar in telemetry.py."""

    def test_default_is_agent_persona(self):
        from telemetry import AGENT_PERSONA, CURRENT_AGENT_PERSONA
        assert CURRENT_AGENT_PERSONA.get() == AGENT_PERSONA

    def test_contextvar_override(self):
        from telemetry import AGENT_PERSONA, CURRENT_AGENT_PERSONA
        token = CURRENT_AGENT_PERSONA.set("sanctum-surgeon")
        try:
            assert CURRENT_AGENT_PERSONA.get() == "sanctum-surgeon"
        finally:
            CURRENT_AGENT_PERSONA.reset(token)
        assert CURRENT_AGENT_PERSONA.get() == AGENT_PERSONA


# ── AgentIdentityMiddleware tests ──────────────────────────────────────

class TestAgentIdentityMiddleware:
    """ASGI middleware resolves X-Sanctum-Agent to correct tokens."""

    @pytest.fixture(autouse=True)
    def _patch_token_map(self, monkeypatch):
        """Inject known tokens into AGENT_TOKEN_MAP for testing."""
        from middleware import agent_identity
        monkeypatch.setattr(agent_identity, "AGENT_TOKEN_MAP", {
            "sanctum-surgeon": "token_surgeon",
            "sanctum-operator": "token_operator",
            "sanctum-oracle": "token_oracle",
            "sanctum-chat": "token_oracle",       # alias
            "sanctum-code": "token_operator",      # alias
        })

    def _make_scope(self, agent_name: str | None = None) -> dict:
        headers = []
        if agent_name is not None:
            headers.append((b"x-sanctum-agent", agent_name.encode()))
        return {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": headers,
        }

    @pytest.mark.asyncio
    async def test_known_agent_sets_token(self):
        from middleware.agent_identity import AgentIdentityMiddleware
        from client import CURRENT_API_TOKEN
        from telemetry import CURRENT_AGENT_PERSONA

        captured = {}

        async def app(scope, receive, send):
            captured["token"] = CURRENT_API_TOKEN.get()
            captured["persona"] = CURRENT_AGENT_PERSONA.get()

        mw = AgentIdentityMiddleware(app)
        await mw(self._make_scope("sanctum-surgeon"), None, None)

        assert captured["token"] == "token_surgeon"
        assert captured["persona"] == "sanctum-surgeon"

    @pytest.mark.asyncio
    async def test_alias_resolves(self):
        from middleware.agent_identity import AgentIdentityMiddleware
        from client import CURRENT_API_TOKEN
        from telemetry import CURRENT_AGENT_PERSONA

        captured = {}

        async def app(scope, receive, send):
            captured["token"] = CURRENT_API_TOKEN.get()
            captured["persona"] = CURRENT_AGENT_PERSONA.get()

        mw = AgentIdentityMiddleware(app)
        await mw(self._make_scope("sanctum-chat"), None, None)

        assert captured["token"] == "token_oracle"
        assert captured["persona"] == "sanctum-chat"

    @pytest.mark.asyncio
    async def test_unknown_agent_falls_back_to_default(self):
        from middleware.agent_identity import AgentIdentityMiddleware
        from client import API_TOKEN, CURRENT_API_TOKEN
        from telemetry import CURRENT_AGENT_PERSONA

        captured = {}

        async def app(scope, receive, send):
            captured["token"] = CURRENT_API_TOKEN.get()
            captured["persona"] = CURRENT_AGENT_PERSONA.get()

        mw = AgentIdentityMiddleware(app)
        await mw(self._make_scope("sanctum-unknown"), None, None)

        assert captured["token"] == API_TOKEN
        assert captured["persona"] == "sanctum-unknown"

    @pytest.mark.asyncio
    async def test_missing_header_falls_back_to_default(self):
        from middleware.agent_identity import AgentIdentityMiddleware
        from client import API_TOKEN, CURRENT_API_TOKEN
        from telemetry import AGENT_PERSONA, CURRENT_AGENT_PERSONA

        captured = {}

        async def app(scope, receive, send):
            captured["token"] = CURRENT_API_TOKEN.get()
            captured["persona"] = CURRENT_AGENT_PERSONA.get()

        mw = AgentIdentityMiddleware(app)
        await mw(self._make_scope(None), None, None)

        assert captured["token"] == API_TOKEN
        assert captured["persona"] == AGENT_PERSONA

    @pytest.mark.asyncio
    async def test_non_http_scope_passes_through(self):
        from middleware.agent_identity import AgentIdentityMiddleware

        called = False

        async def app(scope, receive, send):
            nonlocal called
            called = True

        mw = AgentIdentityMiddleware(app)
        await mw({"type": "lifespan"}, None, None)
        assert called

    @pytest.mark.asyncio
    async def test_contextvar_reset_after_request(self):
        """ContextVars must be reset after middleware completes."""
        from middleware.agent_identity import AgentIdentityMiddleware
        from client import API_TOKEN, CURRENT_API_TOKEN
        from telemetry import AGENT_PERSONA, CURRENT_AGENT_PERSONA

        async def app(scope, receive, send):
            pass

        mw = AgentIdentityMiddleware(app)
        await mw(self._make_scope("sanctum-surgeon"), None, None)

        # After the middleware completes, ContextVars should be back to defaults
        assert CURRENT_API_TOKEN.get() == API_TOKEN
        assert CURRENT_AGENT_PERSONA.get() == AGENT_PERSONA
