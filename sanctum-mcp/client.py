"""HTTP client for Sanctum Core API — used by all MCP tools.

Uses a shared httpx.AsyncClient with connection pooling to avoid
per-request TCP/TLS overhead. Includes retry with backoff for
transient errors (connection resets, 502/503/504).

Authenticates to the core API using the SANCTUM_API_TOKEN env var.
"""

import asyncio
import logging
import os
import time
from contextvars import ContextVar

import httpx
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

API_BASE = os.getenv("SANCTUM_API_BASE", "https://core.digitalsanctum.com.au/api")
API_TOKEN = os.getenv("SANCTUM_API_TOKEN", "")
CURRENT_API_TOKEN: ContextVar[str] = ContextVar("current_api_token", default=API_TOKEN)

_TIMEOUT = httpx.Timeout(30, connect=10)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "")
    if not raw:
        return default
    try:
        return max(1, int(raw))
    except ValueError:
        log.warning("Invalid %s=%r, falling back to %d", name, raw, default)
        return default


_MAX_CONN = _env_int("MCP_MAX_CONNECTIONS", 100)
_MAX_KEEPALIVE = _env_int("MCP_MAX_KEEPALIVE", 50)
_LIMITS = httpx.Limits(max_connections=_MAX_CONN, max_keepalive_connections=_MAX_KEEPALIVE)
_MAX_RETRIES = 3
_RETRY_STATUSES = {502, 503, 504}

_client: httpx.AsyncClient | None = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        log.info("HTTP pool: max_connections=%d, max_keepalive=%d", _MAX_CONN, _MAX_KEEPALIVE)
        _client = httpx.AsyncClient(
            base_url=API_BASE,
            timeout=_TIMEOUT,
            limits=_LIMITS,
        )
    return _client


async def _request(method: str, path: str, **kwargs) -> httpx.Response:
    """Execute an HTTP request with retry on transient errors."""
    from telemetry import CALL_METRICS, _IN_TELEMETRY_POST

    client = await _get_client()
    kwargs.setdefault("headers", {})
    kwargs["headers"]["Authorization"] = f"Bearer {CURRENT_API_TOKEN.get()}"
    kwargs["headers"]["Content-Type"] = "application/json"
    last_exc: Exception | None = None
    start = time.monotonic()
    for attempt in range(_MAX_RETRIES):
        try:
            r = await client.request(method, path, **kwargs)
            if r.status_code not in _RETRY_STATUSES:
                # Record metrics unless this is a telemetry POST (recursion guard)
                if not _IN_TELEMETRY_POST.get(False):
                    try:
                        metrics = CALL_METRICS.get()
                        metrics.append({
                            "response_bytes": len(r.content),
                            "latency_ms": int((time.monotonic() - start) * 1000),
                            "status_code": r.status_code,
                            "attempt": attempt + 1,
                        })
                    except LookupError:
                        pass  # No CALL_METRICS context — not inside a tool call
                return r
            last_exc = httpx.HTTPStatusError(
                f"{r.status_code}", request=r.request, response=r
            )
        except (httpx.ConnectError, httpx.ReadError, httpx.WriteError, httpx.PoolTimeout) as exc:
            last_exc = exc
        if attempt < _MAX_RETRIES - 1:
            wait = 0.5 * (2 ** attempt)
            log.warning("Retry %d/%d for %s %s (%.1fs backoff)", attempt + 1, _MAX_RETRIES, method, path, wait)
            await asyncio.sleep(wait)
    raise last_exc  # type: ignore[misc]


def _check_upstream(r: httpx.Response, method: str, path: str) -> None:
    """Log and raise on upstream auth/permission errors with diagnostic detail."""
    if r.status_code in (401, 403):
        token = CURRENT_API_TOKEN.get()
        token_hint = f"{token[:8]}...{token[-4:]}" if len(token) > 12 else "(empty)"
        body = r.text[:200]
        log.error(
            "UPSTREAM %d | %s %s | token=%s | body=%s",
            r.status_code, method, path, token_hint, body,
        )
    r.raise_for_status()


async def get(path: str, params: dict | None = None) -> dict | list:
    r = await _request("GET", path, params=params)
    _check_upstream(r, "GET", path)
    return r.json()


async def post(path: str, json: dict | None = None) -> dict:
    r = await _request("POST", path, json=json)
    if r.status_code == 422:
        return {"error": True, "status_code": 422, **r.json()}
    _check_upstream(r, "POST", path)
    return r.json()


async def put(path: str, json: dict | None = None) -> dict:
    r = await _request("PUT", path, json=json)
    if r.status_code == 422:
        return {"error": True, "status_code": 422, **r.json()}
    _check_upstream(r, "PUT", path)
    return r.json()


async def patch(path: str, json: dict | None = None) -> dict:
    r = await _request("PATCH", path, json=json)
    _check_upstream(r, "PATCH", path)
    return r.json()


async def delete(path: str) -> dict:
    r = await _request("DELETE", path)
    _check_upstream(r, "DELETE", path)
    return r.json()
