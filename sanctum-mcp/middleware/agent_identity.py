"""ASGI middleware that resolves X-Sanctum-Agent header to per-agent API tokens.

Reads the header from each incoming HTTP request, looks up the agent name in
a startup-loaded token map, and sets ContextVars so that downstream code
(client._request, telemetry) uses the correct identity for the duration of
the request.

Falls back to the process-level defaults when the header is absent or the
agent name is unknown (lenient validation — no 4xx errors).
"""

import logging
import os

from client import API_TOKEN, CURRENT_API_TOKEN
from telemetry import AGENT_PERSONA, CURRENT_AGENT_PERSONA

log = logging.getLogger(__name__)

# ── Token map ──────────────────────────────────────────────────────────

_TOKEN_ENV_MAP = {
    "sanctum-architect": "SANCTUM_TOKEN_ARCHITECT",
    "sanctum-operator": "SANCTUM_TOKEN_OPERATOR",
    "sanctum-scribe": "SANCTUM_TOKEN_SCRIBE",
    "sanctum-sentinel": "SANCTUM_TOKEN_SENTINEL",
    "sanctum-surgeon": "SANCTUM_TOKEN_SURGEON",
    "sanctum-oracle": "SANCTUM_TOKEN_ORACLE",
    "sanctum-hermes": "SANCTUM_TOKEN_HERMES",
}

_ALIASES = {
    "sanctum-chat": "sanctum-oracle",
    "sanctum-code": "sanctum-operator",
}

# Built at import time — maps agent name -> Core API token
AGENT_TOKEN_MAP: dict[str, str] = {}

for _name, _env_var in _TOKEN_ENV_MAP.items():
    _val = os.getenv(_env_var, "")
    if _val:
        AGENT_TOKEN_MAP[_name] = _val

# Resolve aliases to their canonical agent's token
for _alias, _canonical in _ALIASES.items():
    if _canonical in AGENT_TOKEN_MAP:
        AGENT_TOKEN_MAP[_alias] = AGENT_TOKEN_MAP[_canonical]

_loaded = [k for k in AGENT_TOKEN_MAP if k not in _ALIASES]
if _loaded:
    log.info("AgentIdentityMiddleware: loaded tokens for %s", ", ".join(sorted(_loaded)))
else:
    log.warning("AgentIdentityMiddleware: no agent tokens configured; all requests use default")

# Log token prefixes at startup so stale-token issues are diagnosable from logs
for _name in sorted(_loaded):
    _t = AGENT_TOKEN_MAP[_name]
    log.info("  %s: %s...%s", _name, _t[:8], _t[-4:])
_default_token = API_TOKEN
log.info("  (default): %s...%s", _default_token[:8], _default_token[-4:] if len(_default_token) > 12 else "(empty)")


# ── ASGI Middleware ────────────────────────────────────────────────────

class AgentIdentityMiddleware:
    """Resolve X-Sanctum-Agent header and set ContextVars for the request."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        # Read X-Sanctum-Agent from raw ASGI headers (bytes tuples)
        headers = dict(scope.get("headers", []))
        agent_name = headers.get(b"x-sanctum-agent", b"").decode().strip().lower()

        token_to_use = AGENT_TOKEN_MAP.get(agent_name, "") if agent_name else ""
        persona = agent_name if agent_name else AGENT_PERSONA

        effective_token = token_to_use or API_TOKEN
        path = scope.get("path", "?")
        method = scope.get("method", "?")
        token_hint = f"{effective_token[:8]}...{effective_token[-4:]}" if len(effective_token) > 12 else "(empty)"
        source = "agent-header" if token_to_use else "default"
        if agent_name and not token_to_use:
            log.warning("AGENT unknown header=%r, falling back to default | %s %s", agent_name, method, path)
        log.debug("AGENT %s | %s | token=%s | %s %s", persona, source, token_hint, method, path)

        # Set ContextVars — reset after the request completes
        cv_token = CURRENT_API_TOKEN.set(effective_token)
        cv_persona = CURRENT_AGENT_PERSONA.set(persona)
        try:
            return await self.app(scope, receive, send)
        finally:
            CURRENT_API_TOKEN.reset(cv_token)
            CURRENT_AGENT_PERSONA.reset(cv_persona)
