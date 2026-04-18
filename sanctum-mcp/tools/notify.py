"""MCP tools for Sanctum Notify operations.

Wraps the Sanctum Notify HTTP API (sanctum_notify/routes/notify.py and
sanctum_notify/routes/suppress.py). Follows the canonical pattern from
tools/tickets.py — @mcp.tool(annotations=<tier>) + @with_telemetry(...),
async def returning json.dumps(result, indent=2).

Auth and tenant scoping
-----------------------
All HTTP calls go through client_notify (sibling of client). Auth is
Bearer <NOTIFY_API_TOKEN>; Notify hashes the token server-side and uses
the matched ApiKey row's tenant_id to scope every read and write. MCP
tools therefore take NO tenant_id parameter — it is implied by the
configured token. The one pass-through exception is notify_list's
`tenant` filter, which the upstream only honours when the configured
key is an admin key (tenant_id IS NULL); clients cannot validate this
ahead of time, so it's passed through verbatim.
"""

import json

from app import mcp
from cost_tiers import (
    DESTRUCTIVE,
    HEAVY_IDEMPOTENT,
    HEAVY_WRITE,
    LIGHT_READ,
    STANDARD_READ,
)
from telemetry import with_telemetry
import client_notify


# ── Dispatch tools ────────────────────────────────────────────────


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def notify_send(
    to: str,
    template: str,
    data: dict,
    channel: str = "email",
) -> str:
    """Queue a single notification for delivery.

    Wraps POST /notify. This is a HEAVY_WRITE — calling it dispatches a
    real notification (email via AWS SES or SMTP) to the recipient.

    IMPORTANT — silent spam shadow-accept:
        Upstream's spam filter (sanctum-notify/sanctum_notify/routes/
        notify.py:94-99) silently accepts payloads that contain trigger
        keywords (viagra, crypto, bitcoin, buy now, casino, lottery) or
        more than 3 URLs. In that case the endpoint returns a
        queued-looking 202 response with a FAKE UUID and NO DB ROW. The
        notification is never dispatched. A returned UUID therefore does
        NOT guarantee delivery — agents must not report "success" from
        the response shape alone. If in doubt, poll notify_show with the
        returned id: a real notification resolves to a row, a
        shadow-accepted one returns 404.

    Tenant scoping is implied by NOTIFY_API_TOKEN — do not pass a
    tenant_id. Recipients on the suppression list are not re-checked at
    enqueue time for single sends (only batch sends honour that).

    Rate limit: the upstream buckets by client IP at 5 req/min; all MCP
    traffic shares that budget (429 passthrough if exceeded).

    Args:
        to: Recipient email address.
        template: Template slug (must exist in the Notify template catalog).
        data: Template context (dict of values substituted into the
            template). Keys are template-specific.
        channel: Delivery channel. Only "email" is supported today.
    """
    payload = {
        "to": to,
        "template": template,
        "data": data,
        "channel": channel,
    }
    result = await client_notify.post("/notify", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def notify_send_batch(notifications: list[dict]) -> str:
    """Queue a batch of notifications atomically under one batch_id.

    Wraps POST /notify/batch. All items share a single batch_id in the
    response. Capped at 100 items per batch (upstream settings.batch_max_items).

    IMPORTANT — silent spam shadow-accept:
        Items whose `data` contains spam trigger keywords (viagra, crypto,
        bitcoin, buy now, casino, lottery) or more than 3 URLs are
        silently accepted with a FAKE UUID and NO DB ROW (sanctum-notify/
        sanctum_notify/routes/notify.py:137-139). The fake UUID is
        indistinguishable from a real one in notification_ids, so a 202
        response with matching count does NOT guarantee every item was
        queued. To verify, call notify_show on each returned id — real
        ones resolve to rows, shadow-accepted ones 404.

    Batch suppression handling differs from single sends: recipients on
    the suppression list get a real DB row with status="suppressed" (not
    "queued"), so they count toward the batch and appear in notify_list
    filtered by status=suppressed.

    Args:
        notifications: List of up to 100 dicts, each with keys
            {to, template, data, channel}. Shape matches notify_send args.
    """
    payload = {"notifications": notifications}
    result = await client_notify.post("/notify/batch", json=payload)
    return json.dumps(result, indent=2)


# ── Query tools ───────────────────────────────────────────────────


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def notify_list(
    status: str | None = None,
    template: str | None = None,
    since: str | None = None,
    recipient: str | None = None,
    tenant: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> str:
    """List notifications, optionally filtered by status/template/since/recipient.

    Wraps GET /notify. Results are scoped to the tenant implied by
    NOTIFY_API_TOKEN. Ordered by created_at DESC.

    Args:
        status: Filter by status — one of queued, sending, sent, failed,
            dead_letter, suppressed.
        template: Filter by template slug (exact match).
        since: ISO 8601 datetime — only return rows with created_at >= since.
        recipient: Filter by recipient email (exact match).
        tenant: Cross-tenant filter by API-key name. Only honoured when
            the configured NOTIFY_API_TOKEN is an admin key (tenant_id IS
            NULL); for tenant-scoped keys this parameter is silently
            ignored by upstream. Pass through verbatim.
        limit: Max rows (1-200, default 50).
        offset: Pagination offset (default 0).
    """
    params: dict = {"limit": limit, "offset": offset}
    if status is not None:
        params["status"] = status
    if template is not None:
        params["template"] = template
    if since is not None:
        params["since"] = since
    if recipient is not None:
        params["recipient"] = recipient
    if tenant is not None:
        params["tenant"] = tenant
    result = await client_notify.get("/notify", params=params)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=STANDARD_READ)
@with_telemetry("standard")
async def notify_show(notification_id: str) -> str:
    """Show the status and metadata for a single notification.

    Wraps GET /notify/{id}. Returns 404 if the id is unknown, 403 if the
    id belongs to a different tenant than the configured token.

    Args:
        notification_id: UUID of the notification.
    """
    result = await client_notify.get(f"/notify/{notification_id}")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def notify_list_dead_letter(limit: int = 50, offset: int = 0) -> str:
    """List notifications in the dead-letter queue (permanently failed sends).

    Wraps GET /notify/dead-letter. Scoped to the caller's tenant. These
    are candidates for notify_retry once the underlying cause is fixed.

    Args:
        limit: Max rows (1-200, default 50).
        offset: Pagination offset (default 0).
    """
    params = {"limit": limit, "offset": offset}
    result = await client_notify.get("/notify/dead-letter", params=params)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def notify_retry(notification_id: str) -> str:
    """Requeue a dead-lettered notification for another delivery attempt.

    Wraps POST /notify/{id}/retry. Upstream returns 409 if the target is
    not in status="dead_letter", 404 if unknown, 403 cross-tenant.

    Args:
        notification_id: UUID of a notification currently in dead_letter.
    """
    result = await client_notify.post(f"/notify/{notification_id}/retry")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def notify_list_tenants() -> str:
    """List all registered tenants with notification counts (admin-only).

    Wraps GET /notify/tenants. Returns 403 if the configured
    NOTIFY_API_TOKEN is tenant-scoped (admin keys have tenant_id IS NULL).
    """
    result = await client_notify.get("/notify/tenants")
    return json.dumps(result, indent=2)


# ── Suppression tools ─────────────────────────────────────────────


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def notify_suppress_create(
    email: str,
    reason: str = "manual",
    source: str | None = None,
) -> str:
    """Add an email address to the suppression list for the caller's tenant.

    Wraps POST /v1/suppressions. Once suppressed, future sends to the
    address return status="suppressed" instead of dispatching. Existing
    queued rows for the address are not retroactively cancelled.

    Args:
        email: The email address to suppress.
        reason: One of bounce, complaint, unsubscribe, manual (default "manual").
        source: Optional free-text label identifying the origin
            (e.g. "manual:agent", "bounce:ses").
    """
    payload: dict = {"email": email, "reason": reason}
    if source is not None:
        payload["source"] = source
    result = await client_notify.post("/v1/suppressions", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=DESTRUCTIVE)
@with_telemetry("destructive")
async def notify_suppress_delete(email: str) -> str:
    """Remove an email address from the suppression list.

    Wraps DELETE /v1/suppressions/{email}. 404 if the address is not
    currently suppressed for the caller's tenant.

    Args:
        email: The suppressed email address to unsuppress.
    """
    result = await client_notify.delete(f"/v1/suppressions/{email}")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def notify_suppress_list(skip: int = 0, limit: int = 50) -> str:
    """List suppression entries for the caller's tenant.

    Wraps GET /v1/suppressions.

    Args:
        skip: Number of rows to skip (default 0).
        limit: Max rows (1-200, default 50).
    """
    params = {"skip": skip, "limit": limit}
    result = await client_notify.get("/v1/suppressions", params=params)
    return json.dumps(result, indent=2)
