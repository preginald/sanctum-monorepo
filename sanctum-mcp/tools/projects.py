"""MCP tools for Sanctum project operations."""

import json
from app import mcp
import client

RESOLVED_STATUSES = {"resolved"}


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
