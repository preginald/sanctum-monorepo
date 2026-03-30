"""
Sanctum Audit API client.

Wraps POST /api/audits on the Sanctum Audit app (DOC-067).
Uses synchronous httpx since callers run in background tasks.
"""

import os
import logging
import time
import httpx

logger = logging.getLogger(__name__)

SANCTUM_AUDIT_BASE_URL = os.getenv(
    "SANCTUM_AUDIT_BASE_URL", "https://audit.digitalsanctum.com.au"
)
SANCTUM_AUDIT_API_KEY = os.getenv("SANCTUM_AUDIT_API_KEY", "")


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

    headers = {}
    if SANCTUM_AUDIT_API_KEY:
        headers["Authorization"] = f"Bearer {SANCTUM_AUDIT_API_KEY}"

    try:
        with httpx.Client(timeout=httpx.Timeout(30.0, connect=30.0)) as client:
            response = client.post(
                f"{SANCTUM_AUDIT_BASE_URL}/api/audits",
                json=payload,
                headers=headers,
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


def fetch_audit_result(audit_id: str) -> dict:
    """
    Fetch audit result from GET /api/audits/:id.

    Returns the full JSON response dict.  Key fields (per DOC-067):
      - id, url, status ("pending" | "complete" | "error")
      - overall_score (int 0-100) — mapped to AuditReport.security_score
      - categories (dict of category scores)
      - report_url, created_at, completed_at
    """
    headers = {}
    if SANCTUM_AUDIT_API_KEY:
        headers["Authorization"] = f"Bearer {SANCTUM_AUDIT_API_KEY}"

    try:
        with httpx.Client(timeout=httpx.Timeout(30.0)) as client:
            response = client.get(
                f"{SANCTUM_AUDIT_BASE_URL}/api/audits/{audit_id}",
                headers=headers,
            )
    except httpx.ConnectError as e:
        raise AuditAPIError(f"Connection failed: {e}")
    except httpx.TimeoutException as e:
        raise AuditAPIError(f"Request timed out: {e}")
    except httpx.HTTPError as e:
        raise AuditAPIError(f"HTTP error: {e}")

    if response.status_code != 200:
        raise AuditAPIError(
            f"Fetch failed: {response.status_code}",
            status_code=response.status_code,
        )

    return response.json()


def poll_audit_until_complete(
    audit_id: str, interval: int = 5, timeout: int = 120
) -> dict:
    """Poll GET /api/audits/:id until status is 'complete' or 'error'. Returns result dict."""
    elapsed = 0
    while elapsed < timeout:
        result = fetch_audit_result(audit_id)
        status = result.get("status")
        if status == "complete":
            return result
        if status == "error":
            raise AuditAPIError(
                f"Audit scan failed: {result.get('error', 'unknown')}"
            )
        time.sleep(interval)
        elapsed += interval
    raise AuditAPIError(f"Audit scan timed out after {timeout}s")
