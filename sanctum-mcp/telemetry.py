"""MCP usage telemetry — capture and batch-flush tool call metrics (#950).

Provides:
  - ContextVars for tool_name and cost_tier (set by @with_telemetry)
  - CALL_METRICS ContextVar for HTTP-level metrics from client._request()
  - @with_telemetry decorator for tool functions
  - Batch accumulator that flushes every 10 records or 30 seconds
  - Session ID generated at import time
  - _IN_TELEMETRY_POST guard to prevent recursive instrumentation
"""

import asyncio
import contextvars
import logging
import os
import time
import uuid
from functools import wraps

import httpx
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

# ── Identity ────────────────────────────────────────────────────────────

AGENT_PERSONA = os.getenv("MCP_AGENT_PERSONA", "unknown")
SESSION_ID = str(uuid.uuid4())

# ── Context vars ────────────────────────────────────────────────────────

TOOL_NAME: contextvars.ContextVar[str] = contextvars.ContextVar("TOOL_NAME", default="")
TOOL_COST_TIER: contextvars.ContextVar[str] = contextvars.ContextVar("TOOL_COST_TIER", default="")
CALL_METRICS: contextvars.ContextVar[list] = contextvars.ContextVar("CALL_METRICS")

# Guard to prevent recursive telemetry POSTs from being instrumented
_IN_TELEMETRY_POST: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "_IN_TELEMETRY_POST", default=False
)

# ── Batch accumulator ──────────────────────────────────────────────────

_BATCH_SIZE = 10
_FLUSH_INTERVAL = 30  # seconds
_buffer: list[dict] = []
_buffer_lock: asyncio.Lock | None = None
_flush_task: asyncio.Task | None = None

API_BASE = os.getenv("SANCTUM_API_BASE", "https://core.digitalsanctum.com.au/api")
API_TOKEN = os.getenv("SANCTUM_API_TOKEN", "")


def _get_lock() -> asyncio.Lock:
    """Lazy-init the lock (can't create at import if no running loop)."""
    global _buffer_lock
    if _buffer_lock is None:
        _buffer_lock = asyncio.Lock()
    return _buffer_lock


async def _flush_buffer():
    """Send accumulated records to the ingest endpoint."""
    global _buffer
    lock = _get_lock()
    async with lock:
        if not _buffer:
            return
        batch = _buffer[:]
        _buffer = []

    token = _IN_TELEMETRY_POST.set(True)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10)) as c:
            r = await c.post(
                f"{API_BASE}/mcp/telemetry/ingest/batch",
                json={"records": batch},
                headers={
                    "Authorization": f"Bearer {API_TOKEN}",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code >= 400:
                log.warning("Telemetry flush failed: %d %s", r.status_code, r.text[:200])
    except Exception:
        log.debug("Telemetry flush error (non-fatal)", exc_info=True)
    finally:
        _IN_TELEMETRY_POST.reset(token)


async def _periodic_flush():
    """Background task that flushes every _FLUSH_INTERVAL seconds."""
    while True:
        await asyncio.sleep(_FLUSH_INTERVAL)
        try:
            await _flush_buffer()
        except Exception:
            log.debug("Periodic telemetry flush error", exc_info=True)


def _ensure_flush_task():
    """Start the periodic flush task if not already running."""
    global _flush_task
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    if _flush_task is None or _flush_task.done():
        _flush_task = loop.create_task(_periodic_flush())


async def _enqueue(record: dict):
    """Add a record to the buffer; flush if buffer is full."""
    _ensure_flush_task()
    lock = _get_lock()
    async with lock:
        _buffer.append(record)
        should_flush = len(_buffer) >= _BATCH_SIZE
    if should_flush:
        asyncio.create_task(_flush_buffer())


# ── Decorator ───────────────────────────────────────────────────────────

def with_telemetry(cost_tier: str = ""):
    """Decorator that instruments an MCP tool function with telemetry.

    Applied BELOW @mcp.tool() so FastMCP registers the original function
    signature first, then this wrapper adds timing/metrics around it.

    Usage:
        @mcp.tool(annotations=LIGHT_READ)
        @with_telemetry("light")
        async def my_tool(...) -> str:
            ...
    """
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            # Set context vars for client._request() metric accumulation
            t_name = TOOL_NAME.set(fn.__name__)
            t_tier = TOOL_COST_TIER.set(cost_tier)
            metrics_token = CALL_METRICS.set([])

            start = time.monotonic()
            status = "success"
            error_msg = None
            try:
                result = await fn(*args, **kwargs)
                return result
            except Exception as exc:
                status = "error"
                error_msg = str(exc)[:500]
                raise
            finally:
                elapsed_ms = int((time.monotonic() - start) * 1000)
                call_metrics = CALL_METRICS.get()

                total_bytes = sum(m.get("response_bytes", 0) for m in call_metrics)
                token_est = total_bytes // 4 if total_bytes else None

                record = {
                    "tool_name": fn.__name__,
                    "cost_tier": cost_tier or None,
                    "agent_persona": AGENT_PERSONA,
                    "session_id": SESSION_ID,
                    "latency_ms": elapsed_ms,
                    "response_bytes": total_bytes or None,
                    "token_estimate": token_est,
                    "http_calls": len(call_metrics),
                    "status": status,
                    "error_message": error_msg,
                }

                try:
                    asyncio.create_task(_enqueue(record))
                except RuntimeError:
                    log.debug("No event loop for telemetry enqueue")

                TOOL_NAME.reset(t_name)
                TOOL_COST_TIER.reset(t_tier)
                CALL_METRICS.reset(metrics_token)

        return wrapper
    return decorator
