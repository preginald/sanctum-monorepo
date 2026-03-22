"""MCP tools for Sanctum milestone operations."""

import json
import re
from app import mcp
import client


def _compute_health_check(milestone: dict) -> dict:
    """Compute health check stats for a milestone's tickets."""
    tickets = milestone.get("tickets") or []
    total = len(tickets)
    resolved = sum(1 for t in tickets if t.get("status") == "resolved")
    no_criteria = 0
    no_articles = 0
    for t in tickets:
        desc = t.get("description") or ""
        if not re.search(r"- \[[ x]\]", desc, re.IGNORECASE):
            no_criteria += 1
        if not t.get("has_articles", False):
            no_articles += 1
    result = {"resolved": f"{resolved} of {total} tickets resolved"}
    if no_criteria > 0:
        result["missing_criteria"] = f"{no_criteria} ticket(s) have no acceptance criteria"
    if no_articles > 0:
        result["missing_articles"] = f"{no_articles} ticket(s) have no linked articles"
    return result


@mcp.tool()
async def milestone_list(project_id: str) -> str:
    """List milestones for a project.

    Args:
        project_id: UUID of the project.
    """
    # No dedicated milestones list endpoint — extract from project detail
    project = await client.get(f"/projects/{project_id}")
    milestones = project.get("milestones", []) if isinstance(project, dict) else []
    # Return summary fields only to keep response concise
    summary = []
    for m in milestones:
        summary.append({
            "id": m.get("id"),
            "name": m.get("name"),
            "status": m.get("status"),
            "due_date": m.get("due_date"),
            "sequence": m.get("sequence"),
            "ticket_count": len(m.get("tickets", [])),
        })
    return json.dumps(summary, indent=2)


@mcp.tool()
async def milestone_show(milestone_id: str, quiet: bool = False, expand: str = None) -> str:
    """Show details for a milestone.

    Args:
        milestone_id: UUID of the milestone.
        quiet: Set true to suppress health check (useful for batch operations).
        expand: Comma-separated fields to expand (ticket_descriptions,health_check), 'all', or 'none'.
    """
    params = {}
    if expand is not None:
        params["expand"] = expand
    result = await client.get(f"/milestones/{milestone_id}", params=params or None)
    if not quiet and isinstance(result, dict):
        result["health_check"] = _compute_health_check(result)
    return json.dumps(result, indent=2)


@mcp.tool()
async def milestone_create(
    project_id: str,
    name: str,
    description: str | None = None,
    due_date: str | None = None,
    sequence: int | None = None,
) -> str:
    """Create a new milestone under a project.

    Args:
        project_id: UUID of the project.
        name: Milestone name (e.g. 'Phase 79: The Conduit — MCP Server').
        description: Optional description.
        due_date: Optional due date in YYYY-MM-DD format.
        sequence: Optional sequence number for ordering.
    """
    payload = {"name": name}
    if description:
        payload["description"] = description
    if due_date:
        payload["due_date"] = due_date
    if sequence is not None:
        payload["sequence"] = sequence
    result = await client.post(f"/projects/{project_id}/milestones", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
async def milestone_update(
    milestone_id: str,
    name: str | None = None,
    status: str | None = None,
    due_date: str | None = None,
    description: str | None = None,
    sequence: int | None = None,
) -> str:
    """Update a milestone.

    Args:
        milestone_id: UUID of the milestone.
        name: New name.
        status: One of: pending, active, completed.
        due_date: Due date in YYYY-MM-DD format.
        description: New description.
        sequence: Sequence number for ordering.
    """
    payload = {}
    if name is not None:
        payload["name"] = name
    if status is not None:
        payload["status"] = status
    if due_date is not None:
        payload["due_date"] = due_date
    if description is not None:
        payload["description"] = description
    if sequence is not None:
        payload["sequence"] = sequence
    result = await client.put(f"/milestones/{milestone_id}", json=payload)
    return json.dumps(result, indent=2)
