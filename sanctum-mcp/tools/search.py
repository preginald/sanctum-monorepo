"""MCP tools for Sanctum search and context operations."""

import json
from app import mcp
from cost_tiers import LIGHT
import client


@mcp.tool(annotations=LIGHT)
async def search(
    query: str,
    entity_type: str | None = None,
    limit: int = 5,
) -> str:
    """Cross-entity fuzzy search across tickets, articles, clients, assets, projects, milestones, and products.

    Args:
        query: Search query string.
        entity_type: Scope to a specific type: ticket, wiki, client, contact, asset, project, milestone, product. Omit for global search.
        limit: Max results per entity type (default 5, max 20).
    """
    params = {"q": query, "limit": limit}
    result = await client.get("/search", params=params)
    # API does not support type filtering — apply client-side
    if entity_type and isinstance(result, list):
        result = [r for r in result if r.get("type") == entity_type]
    return json.dumps(result, indent=2)
