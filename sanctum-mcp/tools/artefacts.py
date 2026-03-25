"""MCP tools for Sanctum artefact operations."""

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
import client
from token_guard import guard_fetch


def _unescape(s: str | None) -> str | None:
    """Unescape literal \\n sequences from MCP string arguments."""
    if s is None:
        return s
    return s.replace("\\n", "\n")


def _parse_metadata(metadata: str | None) -> dict | None:
    """Parse a JSON string into a dict for the metadata field."""
    if metadata is None:
        return None
    try:
        return json.loads(metadata)
    except (json.JSONDecodeError, TypeError):
        return None


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def artefact_list(
    account_id: str | None = None,
    artefact_type: str | None = None,
    status: str | None = None,
    category: str | None = None,
    sensitivity: str | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> str:
    """List artefacts with optional filters, search, and sorting.

    Args:
        account_id: Filter by account UUID.
        artefact_type: Filter by type: file, url, code_path, document, credential_ref.
        status: Filter by status: draft, review, approved, archived, superseded.
        category: Filter by category string.
        sensitivity: Filter by sensitivity: public, internal, confidential, restricted.
        search: Search term (matches name, description, content).
        sort_by: Sort column: name, created_at, updated_at, status (default: created_at).
        sort_order: Sort direction: asc or desc (default: desc).
    """
    params = {}
    if account_id:
        params["account_id"] = account_id
    if artefact_type:
        params["artefact_type"] = artefact_type
    if status:
        params["status"] = status
    if category:
        params["category"] = category
    if sensitivity:
        params["sensitivity"] = sensitivity
    if search:
        params["search"] = search
    if sort_by:
        params["sort_by"] = sort_by
    if sort_order:
        params["sort_order"] = sort_order
    result = await client.get("/artefacts", params=params)
    # Return summary fields only
    artefacts = result if isinstance(result, list) else []
    summary = []
    for a in artefacts:
        summary.append({
            "id": a.get("id"),
            "name": a.get("name"),
            "artefact_type": a.get("artefact_type"),
            "status": a.get("status"),
            "category": a.get("category"),
            "sensitivity": a.get("sensitivity"),
            "url": a.get("url"),
            "account_name": a.get("account_name"),
            "links_count": len(a.get("links", [])),
            "created_at": a.get("created_at"),
        })
    return json.dumps(summary, indent=2)


@mcp.tool(annotations=STANDARD_READ)
@with_telemetry("standard")
async def artefact_show(artefact_id: str, expand: str | None = None, force: bool = False) -> str:
    """Show details for an artefact by UUID.

    Args:
        artefact_id: UUID of the artefact.
        expand: Comma-separated fields to expand (content,description), 'all', or 'none'. Content and description excluded by default for service accounts.
        force: Set true to bypass the token guard and fetch full content regardless of document size.
    """
    guarded = await guard_fetch("artefact", artefact_id, expand, force=force)
    if guarded is not None:
        return guarded
    params = {}
    if expand is not None:
        params["expand"] = expand
    result = await client.get(f"/artefacts/{artefact_id}", params=params or None)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def artefact_sections(artefact_id: str) -> str:
    """List all section headings in an artefact's content.

    Args:
        artefact_id: UUID of the artefact.
    """
    result = await client.get(f"/artefacts/{artefact_id}/sections")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def artefact_read_section(
    artefact_id: str,
    section_heading: str,
    index: int = 0,
) -> str:
    """Read a single section of an artefact by heading.

    Args:
        artefact_id: UUID of the artefact.
        section_heading: Exact heading string (e.g. '## Implementation').
        index: Disambiguation index for duplicate headings (default 0).
    """
    result = await client.get(
        f"/artefacts/{artefact_id}/sections",
        params={"section": section_heading, "index": index},
    )
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def artefact_create(
    name: str,
    artefact_type: str,
    url: str | None = None,
    description: str | None = None,
    account_id: str | None = None,
    content: str | None = None,
    status: str | None = None,
    category: str | None = None,
    sensitivity: str | None = None,
    metadata: str | None = None,
    mime_type: str | None = None,
    file_size: int | None = None,
    superseded_by: str | None = None,
    quiet: bool = False,
) -> str:
    """Create a new artefact.

    Args:
        name: Artefact name.
        artefact_type: One of: file, url, code_path, document, credential_ref.
        url: URL or path (optional).
        description: Description in markdown (optional).
        account_id: UUID of the account (optional, omit for internal).
        content: Markdown content body (optional).
        status: Initial status: draft, review, approved (default: draft).
        category: Category string, e.g. config, diagram, policy, runbook (optional).
        sensitivity: One of: public, internal, confidential, restricted (default: internal).
        metadata: JSON string of key-value metadata (optional).
        mime_type: MIME type, e.g. application/pdf (optional).
        file_size: File size in bytes (optional).
        superseded_by: UUID of the artefact that supersedes this one (optional).
        quiet: Set true to suppress guidance messages (useful for batch operations).
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
    if content is not None:
        payload["content"] = _unescape(content)
    if status is not None:
        payload["status"] = status
    if category is not None:
        payload["category"] = category
    if sensitivity is not None:
        payload["sensitivity"] = sensitivity
    if metadata is not None:
        parsed = _parse_metadata(metadata)
        if parsed is not None:
            payload["metadata"] = parsed
    if mime_type is not None:
        payload["mime_type"] = mime_type
    if file_size is not None:
        payload["file_size"] = file_size
    if superseded_by is not None:
        payload["superseded_by"] = superseded_by
    result = await client.post("/artefacts", json=payload)
    if not quiet and isinstance(result, dict) and result.get("id"):
        result["guidance"] = "Link this artefact to at least one entity (ticket, project, milestone) with artefact_link to prevent orphaning."
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def artefact_update(
    artefact_id: str,
    name: str | None = None,
    artefact_type: str | None = None,
    url: str | None = None,
    description: str | None = None,
    account_id: str | None = None,
    content: str | None = None,
    status: str | None = None,
    category: str | None = None,
    sensitivity: str | None = None,
    metadata: str | None = None,
    mime_type: str | None = None,
    file_size: int | None = None,
    superseded_by: str | None = None,
    change_comment: str | None = None,
) -> str:
    """Update an artefact. Only provided fields are changed.

    Args:
        artefact_id: UUID of the artefact.
        name: New name.
        artefact_type: One of: file, url, code_path, document, credential_ref.
        url: New URL or path.
        description: New description.
        account_id: UUID of the account.
        content: New markdown content body.
        status: New status: draft, review, approved, archived, superseded.
        category: New category string.
        sensitivity: One of: public, internal, confidential, restricted.
        metadata: JSON string of key-value metadata.
        mime_type: MIME type, e.g. application/pdf.
        file_size: File size in bytes.
        superseded_by: UUID of the artefact that supersedes this one.
        change_comment: Comment describing what changed (stored in version history).
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
    if content is not None:
        payload["content"] = _unescape(content)
    if status is not None:
        payload["status"] = status
    if category is not None:
        payload["category"] = category
    if sensitivity is not None:
        payload["sensitivity"] = sensitivity
    if metadata is not None:
        parsed = _parse_metadata(metadata)
        if parsed is not None:
            payload["metadata"] = parsed
    if mime_type is not None:
        payload["mime_type"] = mime_type
    if file_size is not None:
        payload["file_size"] = file_size
    if superseded_by is not None:
        payload["superseded_by"] = superseded_by
    if change_comment is not None:
        payload["change_comment"] = change_comment
    result = await client.put(f"/artefacts/{artefact_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=DESTRUCTIVE)
@with_telemetry("destructive")
async def artefact_delete(artefact_id: str) -> str:
    """Soft-delete (archive) an artefact.

    Args:
        artefact_id: UUID of the artefact.
    """
    result = await client.delete(f"/artefacts/{artefact_id}")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
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


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
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


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def artefact_history(
    artefact_id: str,
    page: int = 1,
    page_size: int = 20,
) -> str:
    """List version history for an artefact.

    Args:
        artefact_id: UUID of the artefact.
        page: Page number (default 1).
        page_size: Items per page (default 20).
    """
    result = await client.get(f"/artefacts/{artefact_id}/history?page={page}&page_size={page_size}")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def artefact_revert(
    artefact_id: str,
    history_id: str,
    change_comment: str | None = None,
) -> str:
    """Revert an artefact to a previous version.

    Args:
        artefact_id: UUID of the artefact.
        history_id: UUID of the history entry to revert to.
        change_comment: Optional comment explaining the revert.
    """
    payload = {}
    if change_comment:
        payload["change_comment"] = change_comment
    result = await client.post(f"/artefacts/{artefact_id}/revert/{history_id}", json=payload)
    return json.dumps(result, indent=2)
