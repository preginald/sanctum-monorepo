"""MCP tools for Sanctum milestone operations."""

import json
from app import mcp
import client


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
async def milestone_show(milestone_id: str) -> str:
    """Show details for a milestone.

    Args:
        milestone_id: UUID of the milestone.
    """
    result = await client.get(f"/milestones/{milestone_id}")
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
