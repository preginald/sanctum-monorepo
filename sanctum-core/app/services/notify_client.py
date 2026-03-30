"""
Sanctum Notify API client.

Wraps POST /api/notify on the Sanctum Notify service.
Uses synchronous httpx since callers run in background tasks.
Fire-and-forget semantics: errors are logged, never raised.
"""

import os
import logging
import time
import httpx

logger = logging.getLogger(__name__)

NOTIFY_API_URL = os.getenv("NOTIFY_API_URL", "https://notify.digitalsanctum.com.au")
NOTIFY_API_KEY = os.getenv("NOTIFY_API_KEY", "")

# Maps Core event_type strings to Notify template slugs.
# Only events in this mapping are dispatched via Notify;
# unmapped events fall back to the legacy _send_immediate() path.
EVENT_TYPE_TO_TEMPLATE = {
    "ticket_assigned": "ticket-assigned",
    "ticket_status_change": "ticket-status-change",
    "ticket_comment": "ticket-comment",
}


class NotifyAPIError(Exception):
    """Raised internally; never escapes this module."""

    def __init__(self, message: str, status_code: int = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def send(to: str, template: str, data: dict) -> dict | None:
    """
    POST /api/notify — queue a notification for delivery.

    Returns response dict on success (HTTP 202), None on any failure.
    Never raises — all errors are logged and swallowed.
    """
    if not NOTIFY_API_KEY:
        logger.warning("NOTIFY_API_KEY not configured — skipping Notify dispatch")
        return None

    payload = {
        "channel": "email",
        "to": to,
        "template": template,
        "data": data,
    }

    headers = {
        "Authorization": f"Bearer {NOTIFY_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=httpx.Timeout(10.0)) as client:
            response = client.post(
                f"{NOTIFY_API_URL}/api/notify",
                json=payload,
                headers=headers,
            )

        if response.status_code in (200, 201, 202):
            result = response.json()
            logger.info(
                "Notify dispatch OK: template=%s to=%s id=%s",
                template, to, result.get("id"),
            )
            return result

        detail = response.text[:500]
        logger.warning(
            "Notify API returned %d for template=%s to=%s: %s",
            response.status_code, template, to, detail,
        )
        return None

    except httpx.ConnectError as e:
        logger.warning("Notify connection failed: %s", e)
        return None
    except httpx.TimeoutException as e:
        logger.warning("Notify request timed out: %s", e)
        return None
    except httpx.HTTPError as e:
        logger.warning("Notify HTTP error: %s", e)
        return None
    except Exception as e:
        logger.warning("Notify unexpected error: %s", e)
        return None


def health_check() -> dict:
    """
    GET /health — check Notify service reachability.

    Returns {"status": "ok", "latency_ms": float}
    or {"status": "error", "message": str}.
    """
    try:
        t0 = time.time()
        with httpx.Client(timeout=httpx.Timeout(5.0)) as client:
            response = client.get(f"{NOTIFY_API_URL}/health")
        latency_ms = (time.time() - t0) * 1000

        if response.status_code == 200:
            return {"status": "ok", "latency_ms": round(latency_ms, 2)}

        return {
            "status": "error",
            "message": f"HTTP {response.status_code}",
            "latency_ms": round(latency_ms, 2),
        }

    except httpx.ConnectError as e:
        return {"status": "error", "message": f"Connection failed: {e}"}
    except httpx.TimeoutException as e:
        return {"status": "error", "message": f"Timed out: {e}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
