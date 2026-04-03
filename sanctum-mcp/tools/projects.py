"""MCP tools for Sanctum project operations."""

import json
from app import mcp
from cost_tiers import HEAVY_IDEMPOTENT, HEAVY_WRITE, LIGHT_READ, STANDARD_READ
from telemetry import with_telemetry
import client

RESOLVED_STATUSES = {"resolved"}
DS_HQ = "dbc2c7b9-d8c2-493f-a6ed-527f7d191068"


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def project_list(
    account_id: str | None = None,
) -> str:
    """List projects with optional account filter.

    Args:
        account_id: Filter by account UUID. Omit for all projects.
    """
    params = {}
    if account_id:
        params["account_id"] = account_id
    result = await client.get("/projects", params=params)
    if isinstance(result, list):
        summary = [
            {
                "id": p.get("id"),
                "name": p.get("name"),
                "account_name": p.get("account_name"),
                "status": p.get("status"),
                "due_date": p.get("due_date"),
            }
            for p in result
        ]
        return json.dumps(summary, indent=2)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=STANDARD_READ)
@with_telemetry("standard")
async def project_show(project_id: str, expand: str | None = None) -> str:
    """Show details for a project by UUID.

    Args:
        project_id: UUID of the project.
        expand: Comma-separated fields to expand (milestones,artefacts), 'all', or 'none'.
    """
    params = {}
    if expand is not None:
        params["expand"] = expand
    result = await client.get(f"/projects/{project_id}", params=params or None)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def project_create(
    name: str,
    account_id: str = DS_HQ,
    description: str | None = None,
    status: str = "capture",
    due_date: str | None = None,
    budget: str | None = None,
    market_value: str | None = None,
    quoted_price: str | None = None,
    discount_amount: str | None = None,
    discount_reason: str | None = None,
    pricing_model: str | None = None,
) -> str:
    """Create a new project.

    Args:
        name: Project name.
        account_id: UUID of the account (defaults to Digital Sanctum HQ).
        description: Optional project description.
        status: Project status. Default "capture". One of: capture, planning, active, completed, on_hold.
        due_date: Optional due date in YYYY-MM-DD format.
        budget: Optional budget as decimal string (e.g. "5000.00").
        market_value: Agency-rate benchmark as decimal string (e.g. "10000.00").
        quoted_price: Actual price quoted to client as decimal string.
        discount_amount: Discount as decimal string (market_value - quoted_price).
        discount_reason: Required when discount_amount > 0 (e.g. "launch support").
        pricing_model: One of: fixed_price, time_and_materials.
    """
    payload = {"account_id": account_id, "name": name, "status": status}
    for key, val in {
        "description": description, "due_date": due_date, "budget": budget,
        "market_value": market_value, "quoted_price": quoted_price,
        "discount_amount": discount_amount, "discount_reason": discount_reason,
        "pricing_model": pricing_model,
    }.items():
        if val is not None:
            payload[key] = val
    result = await client.post("/projects", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def project_update(
    project_id: str,
    name: str | None = None,
    status: str | None = None,
    description: str | None = None,
    budget: str | None = None,
    due_date: str | None = None,
    market_value: str | None = None,
    quoted_price: str | None = None,
    discount_amount: str | None = None,
    discount_reason: str | None = None,
    pricing_model: str | None = None,
) -> str:
    """Update a project. Only provided fields are changed.

    Args:
        project_id: UUID of the project.
        name: New project name.
        status: One of: capture, planning, active, completed, on_hold, archived.
        description: New description.
        budget: Budget as decimal string (e.g. "5000.00").
        due_date: Due date in YYYY-MM-DD format.
        market_value: Agency-rate benchmark as decimal string (e.g. "10000.00").
        quoted_price: Actual price quoted to client as decimal string.
        discount_amount: Discount as decimal string (market_value - quoted_price).
        discount_reason: Required when discount_amount > 0 (e.g. "launch support").
        pricing_model: One of: fixed_price, time_and_materials.
    """
    payload = {}
    for key, val in {
        "name": name, "status": status, "description": description,
        "budget": budget, "due_date": due_date, "market_value": market_value,
        "quoted_price": quoted_price, "discount_amount": discount_amount,
        "discount_reason": discount_reason, "pricing_model": pricing_model,
    }.items():
        if val is not None:
            payload[key] = val
    result = await client.put(f"/projects/{project_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=STANDARD_READ)
@with_telemetry("standard")
async def project_overview(
    project_id: str,
    status: str = "open",
) -> str:
    """Get open tickets grouped by milestone for a project. Ideal for session start.

    Args:
        project_id: UUID of the project.
        status: Filter tickets by status. Default "open" excludes resolved. Use "all" for no filter.
    """
    project = await client.get(f"/projects/{project_id}", params={"expand": "milestones"})
    milestones = project.get("milestones", []) if isinstance(project, dict) else []

    # Sort by sequence
    milestones.sort(key=lambda m: m.get("sequence") or 0)

    result_milestones = []
    for m in milestones:
        tickets = m.get("tickets", [])

        # Filter tickets
        if status != "all":
            tickets = [t for t in tickets if t.get("status") not in RESOLVED_STATUSES]

        if not tickets:
            continue

        result_milestones.append({
            "name": m.get("name"),
            "status": m.get("status"),
            "id": m.get("id"),
            "tickets": [
                {
                    "id": t.get("id"),
                    "subject": t.get("subject"),
                    "status": t.get("status"),
                    "priority": t.get("priority"),
                    "ticket_type": t.get("ticket_type"),
                }
                for t in tickets
            ],
        })

    overview = {
        "project": project.get("name"),
        "account": project.get("account_name"),
        "budget": project.get("budget"),
        "market_value": project.get("market_value"),
        "quoted_price": project.get("quoted_price"),
        "discount_amount": project.get("discount_amount"),
        "discount_reason": project.get("discount_reason"),
        "pricing_model": project.get("pricing_model"),
        "milestones": result_milestones,
    }
    return json.dumps(overview, indent=2)


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def rate_card_list(
    account_id: str | None = None,
    tier: str | None = None,
    system: bool = False,
) -> str:
    """List rate cards with optional filters.

    Args:
        account_id: Filter by account UUID.
        tier: Filter by tier (project_delivery, reactive, consulting, internal).
        system: Set true to list only system defaults (account_id is NULL).
    """
    params = {}
    if system:
        params["system"] = "true"
    elif account_id:
        params["account_id"] = account_id
    if tier:
        params["tier"] = tier
    result = await client.get("/rate-cards", params=params)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def rate_card_create(
    tier: str,
    hourly_rate: str,
    effective_from: str,
    account_id: str | None = None,
) -> str:
    """Create a rate card. Omit account_id for a system default.

    Args:
        tier: One of: project_delivery, reactive, consulting, internal.
        hourly_rate: Rate in AUD as decimal string (e.g. "250.00").
        effective_from: Date in YYYY-MM-DD format.
        account_id: UUID of the account for an override. Omit for system default.
    """
    payload = {"tier": tier, "hourly_rate": hourly_rate, "effective_from": effective_from}
    if account_id:
        payload["account_id"] = account_id
    result = await client.post("/rate-cards", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def rate_card_update(
    card_id: str,
    hourly_rate: str | None = None,
    effective_from: str | None = None,
) -> str:
    """Update a rate card.

    Args:
        card_id: UUID of the rate card.
        hourly_rate: New rate in AUD as decimal string.
        effective_from: New effective date in YYYY-MM-DD format.
    """
    payload = {}
    if hourly_rate is not None:
        payload["hourly_rate"] = hourly_rate
    if effective_from is not None:
        payload["effective_from"] = effective_from
    result = await client.put(f"/rate-cards/{card_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def rate_card_lookup(
    account_id: str,
    tier: str,
    as_of: str | None = None,
) -> str:
    """Look up the effective rate for an account and tier. Returns account override if exists, otherwise system default.

    Args:
        account_id: UUID of the account.
        tier: One of: project_delivery, reactive, consulting, internal.
        as_of: Optional date in YYYY-MM-DD format. Defaults to today.
    """
    params = {"account_id": account_id, "tier": tier}
    if as_of:
        params["as_of"] = as_of
    result = await client.get("/rate-cards/lookup", params=params)
    return json.dumps(result, indent=2)
