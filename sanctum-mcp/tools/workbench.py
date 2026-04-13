"""MCP tools for Sanctum Workbench — per-operator project pinning (#1917)."""

import json
from app import mcp
from cost_tiers import DESTRUCTIVE, HEAVY_IDEMPOTENT, LIGHT_READ
from telemetry import with_telemetry
import client


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def workbench_list() -> str:
    """List pinned projects on the operator's workbench with ticket summaries."""
    result = await client.get("/workbench")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def workbench_pin(
    project_id: str,
    position: int | None = None,
) -> str:
    """Pin a project to the workbench. Idempotent — updates position if already pinned.

    Args:
        project_id: UUID of the project to pin.
        position: Optional display position (default 0).
    """
    payload = {"project_id": project_id}
    if position is not None:
        payload["position"] = position
    result = await client.post("/workbench/pin", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=DESTRUCTIVE)
@with_telemetry("destructive")
async def workbench_unpin(project_id: str) -> str:
    """Remove a project from the workbench.

    Args:
        project_id: UUID of the project to unpin.
    """
    result = await client.delete(f"/workbench/pin/{project_id}")
    return json.dumps(result, indent=2)
