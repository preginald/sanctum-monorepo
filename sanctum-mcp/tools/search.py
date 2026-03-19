"""MCP tools for Sanctum search and context operations."""

import json
from app import mcp
import client


@mcp.tool()
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
    if entity_type:
        params["type"] = entity_type
    result = await client.get("/search", params=params)
    return json.dumps(result, indent=2)
