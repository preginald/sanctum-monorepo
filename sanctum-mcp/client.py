"""HTTP client for Sanctum Core API — used by all MCP tools.

Uses a shared httpx.AsyncClient with connection pooling to avoid
per-request TCP/TLS overhead. Includes retry with backoff for
transient errors (connection resets, 502/503/504).
"""

import asyncio
import logging
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

API_BASE = os.getenv("SANCTUM_API_BASE", "https://core.digitalsanctum.com.au/api")
API_TOKEN = os.getenv("SANCTUM_API_TOKEN", "")

_TIMEOUT = httpx.Timeout(30, connect=10)
_LIMITS = httpx.Limits(max_connections=20, max_keepalive_connections=10)
_MAX_RETRIES = 3
_RETRY_STATUSES = {502, 503, 504}

_client: httpx.AsyncClient | None = None


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
    }


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=API_BASE,
            headers=_headers(),
            timeout=_TIMEOUT,
            limits=_LIMITS,
        )
    return _client


async def _request(method: str, path: str, **kwargs) -> httpx.Response:
    """Execute an HTTP request with retry on transient errors."""
    client = await _get_client()
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            r = await client.request(method, path, **kwargs)
            if r.status_code not in _RETRY_STATUSES:
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


async def get(path: str, params: dict | None = None) -> dict | list:
    r = await _request("GET", path, params=params)
    r.raise_for_status()
    return r.json()


async def post(path: str, json: dict | None = None) -> dict:
    r = await _request("POST", path, json=json)
    if r.status_code == 422:
        return {"error": True, "status_code": 422, **r.json()}
    r.raise_for_status()
    return r.json()


async def put(path: str, json: dict | None = None) -> dict:
    r = await _request("PUT", path, json=json)
    if r.status_code == 422:
        return {"error": True, "status_code": 422, **r.json()}
    r.raise_for_status()
    return r.json()


async def patch(path: str, json: dict | None = None) -> dict:
    r = await _request("PATCH", path, json=json)
    r.raise_for_status()
    return r.json()


async def delete(path: str) -> dict:
    r = await _request("DELETE", path)
    r.raise_for_status()
    return r.json()
