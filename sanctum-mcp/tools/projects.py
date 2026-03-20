"""MCP tools for Sanctum project operations."""

import json
from app import mcp
import client

RESOLVED_STATUSES = {"resolved"}
DS_HQ = "dbc2c7b9-d8c2-493f-a6ed-527f7d191068"


@mcp.tool()
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


@mcp.tool()
async def project_show(project_id: str) -> str:
    """Show details for a project by UUID.

    Args:
        project_id: UUID of the project.
    """
    result = await client.get(f"/projects/{project_id}")
    return json.dumps(result, indent=2)


@mcp.tool()
async def project_create(
    name: str,
    account_id: str = DS_HQ,
    description: str | None = None,
    due_date: str | None = None,
    budget: str | None = None,
) -> str:
    """Create a new project.

    Args:
        name: Project name.
        account_id: UUID of the account (defaults to Digital Sanctum HQ).
        description: Optional project description.
        due_date: Optional due date in YYYY-MM-DD format.
        budget: Optional budget as decimal string (e.g. "5000.00").
    """
    payload = {"account_id": account_id, "name": name}
    if description:
        payload["description"] = description
    if due_date:
        payload["due_date"] = due_date
    if budget:
        payload["budget"] = budget
    result = await client.post("/projects", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
async def project_update(
    project_id: str,
    name: str | None = None,
    status: str | None = None,
    description: str | None = None,
    budget: str | None = None,
    due_date: str | None = None,
) -> str:
    """Update a project. Only provided fields are changed.

    Args:
        project_id: UUID of the project.
        name: New project name.
        status: One of: active, completed, on_hold, archived.
        description: New description.
        budget: Budget as decimal string (e.g. "5000.00").
        due_date: Due date in YYYY-MM-DD format.
    """
    payload = {}
    if name is not None:
        payload["name"] = name
    if status is not None:
        payload["status"] = status
    if description is not None:
        payload["description"] = description
    if budget is not None:
        payload["budget"] = budget
    if due_date is not None:
        payload["due_date"] = due_date
    result = await client.put(f"/projects/{project_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
async def project_overview(
    project_id: str,
    status: str = "open",
) -> str:
    """Get open tickets grouped by milestone for a project. Ideal for session start.

    Args:
        project_id: UUID of the project.
        status: Filter tickets by status. Default "open" excludes resolved. Use "all" for no filter.
    """
    project = await client.get(f"/projects/{project_id}")
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
        "milestones": result_milestones,
    }
    return json.dumps(overview, indent=2)
