"""MCP tools for Sanctum artefact operations."""

import json
from app import mcp
import client


def _unescape(s: str | None) -> str | None:
    """Unescape literal \\n sequences from MCP string arguments."""
    if s is None:
        return s
    return s.replace("\\n", "\n")


@mcp.tool()
async def artefact_list(
    account_id: str | None = None,
    artefact_type: str | None = None,
) -> str:
    """List artefacts, optionally filtered by account or type.

    Args:
        account_id: Filter by account UUID.
        artefact_type: Filter by type: file, url, code_path, document, credential_ref.
    """
    params = {}
    if account_id:
        params["account_id"] = account_id
    if artefact_type:
        params["artefact_type"] = artefact_type
    result = await client.get("/artefacts", params=params)
    # Return summary fields only
    artefacts = result if isinstance(result, list) else []
    summary = []
    for a in artefacts:
        summary.append({
            "id": a.get("id"),
            "name": a.get("name"),
            "artefact_type": a.get("artefact_type"),
            "url": a.get("url"),
            "account_name": a.get("account_name"),
            "links_count": len(a.get("links", [])),
            "created_at": a.get("created_at"),
        })
    return json.dumps(summary, indent=2)


@mcp.tool()
async def artefact_show(artefact_id: str) -> str:
    """Show details for an artefact by UUID.

    Args:
        artefact_id: UUID of the artefact.
    """
    result = await client.get(f"/artefacts/{artefact_id}")
    return json.dumps(result, indent=2)


@mcp.tool()
async def artefact_create(
    name: str,
    artefact_type: str,
    url: str | None = None,
    description: str | None = None,
    account_id: str | None = None,
) -> str:
    """Create a new artefact.

    Args:
        name: Artefact name.
        artefact_type: One of: file, url, code_path, document, credential_ref.
        url: URL or path (optional).
        description: Description in markdown (optional).
        account_id: UUID of the account (optional, omit for internal).
    """
    payload = {
        "name": name,
        "artefact_type": artefact_type,
    }
    if url:
        payload["url"] = url
    if description:
        payload["description"] = _unescape(description)
    if account_id:
        payload["account_id"] = account_id
    result = await client.post("/artefacts", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
async def artefact_update(
    artefact_id: str,
    name: str | None = None,
    artefact_type: str | None = None,
    url: str | None = None,
    description: str | None = None,
    account_id: str | None = None,
) -> str:
    """Update an artefact. Only provided fields are changed.

    Args:
        artefact_id: UUID of the artefact.
        name: New name.
        artefact_type: One of: file, url, code_path, document, credential_ref.
        url: New URL or path.
        description: New description.
        account_id: UUID of the account.
    """
    payload = {}
    if name is not None:
        payload["name"] = name
    if artefact_type is not None:
        payload["artefact_type"] = artefact_type
    if url is not None:
        payload["url"] = url
    if description is not None:
        payload["description"] = _unescape(description)
    if account_id is not None:
        payload["account_id"] = account_id
    result = await client.put(f"/artefacts/{artefact_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
async def artefact_delete(artefact_id: str) -> str:
    """Soft-delete (archive) an artefact.

    Args:
        artefact_id: UUID of the artefact.
    """
    result = await client.delete(f"/artefacts/{artefact_id}")
    return json.dumps(result, indent=2)


@mcp.tool()
async def artefact_link(
    artefact_id: str,
    entity_type: str,
    entity_id: str,
) -> str:
    """Link an artefact to a ticket, account, article, project, or milestone.

    Args:
        artefact_id: UUID of the artefact.
        entity_type: One of: ticket, account, article, project, milestone.
        entity_id: ID of the entity (ticket number or UUID).
    """
    payload = {
        "entity_type": entity_type,
        "entity_id": entity_id,
    }
    result = await client.post(f"/artefacts/{artefact_id}/link", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
async def artefact_unlink(
    artefact_id: str,
    entity_type: str,
    entity_id: str,
) -> str:
    """Remove a link between an artefact and a ticket, account, article, project, or milestone.

    Args:
        artefact_id: UUID of the artefact.
        entity_type: One of: ticket, account, article, project, milestone.
        entity_id: ID of the entity (ticket number or UUID).
    """
    result = await client.delete(f"/artefacts/{artefact_id}/link/{entity_type}/{entity_id}")
    return json.dumps(result, indent=2)
