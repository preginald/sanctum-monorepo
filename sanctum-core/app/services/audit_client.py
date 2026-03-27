"""
Sanctum Audit API client.

Wraps POST /api/audits on the Sanctum Audit app (DOC-067).
Uses synchronous httpx since callers run in background tasks.
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)

SANCTUM_AUDIT_BASE_URL = os.getenv(
    "SANCTUM_AUDIT_BASE_URL", "https://audit.digitalsanctum.com.au"
)


class AuditAPIError(Exception):
    """Raised when the Sanctum Audit API returns a non-success response."""

    def __init__(self, message: str, status_code: int = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def trigger_audit(
    url: str, name: str, email: str, business_name: str
) -> dict:
    """
    Call POST /api/audits on the Sanctum Audit app.

    Returns dict with 'id' and 'report_url' (absolute URL).
    Raises AuditAPIError on failure.
    """
    payload = {
        "url": url,
        "name": name,
        "email": email,
        "business_name": business_name,
    }

    try:
        with httpx.Client(timeout=httpx.Timeout(30.0, connect=30.0)) as client:
            response = client.post(
                f"{SANCTUM_AUDIT_BASE_URL}/api/audits", json=payload
            )
    except httpx.ConnectError as e:
        raise AuditAPIError(f"Connection failed: {e}")
    except httpx.TimeoutException as e:
        raise AuditAPIError(f"Request timed out: {e}")
    except httpx.HTTPError as e:
        raise AuditAPIError(f"HTTP error: {e}")

    if response.status_code == 429:
        raise AuditAPIError(
            "Sanctum Audit API rate limit exceeded. Retry later.",
            status_code=429,
        )

    if response.status_code not in (200, 201, 202):
        detail = response.text[:500]
        raise AuditAPIError(
            f"Audit API returned {response.status_code}: {detail}",
            status_code=response.status_code,
        )

    data = response.json()
    audit_id = data.get("id")

    # report_url from the API is relative (/report/{id}), build absolute
    report_url = f"{SANCTUM_AUDIT_BASE_URL}/report/{audit_id}"

    return {
        "id": audit_id,
        "report_url": report_url,
        "status": data.get("status"),
    }
