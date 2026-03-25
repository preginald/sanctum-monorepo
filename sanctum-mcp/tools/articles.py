"""MCP tools for Sanctum article (wiki) operations."""

import json
from app import mcp
from cost_tiers import (
    HEAVY_IDEMPOTENT,
    HEAVY_WRITE,
    LIGHT_READ,
    STANDARD_READ,
)
import client
from token_guard import guard_fetch


def _unescape(s: str | None) -> str | None:
    """Unescape literal \\n sequences from MCP string arguments."""
    if s is None:
        return s
    return s.replace("\\n", "\n")


@mcp.tool(annotations=LIGHT_READ)
async def article_list() -> str:
    """List all articles in the knowledge base."""
    result = await client.get("/articles")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=STANDARD_READ)
async def article_show(slug: str, expand: str | None = None, force: bool = False) -> str:
    """Show an article by slug or identifier (e.g. DOC-009, SOP-099).

    Args:
        slug: Article slug or identifier.
        expand: Comma-separated fields to expand (content,history,related_articles,artefacts), 'all', or 'none'. Content excluded by default for service accounts.
        force: Set true to bypass the token guard and fetch full content regardless of document size.
    """
    guarded = await guard_fetch("article", slug, expand, force=force)
    if guarded is not None:
        return guarded
    params = {}
    if expand is not None:
        params["expand"] = expand
    result = await client.get(f"/articles/{slug}", params=params or None)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
async def article_create(
    title: str,
    slug: str,
    category: str,
    content: str,
    identifier: str | None = None,
) -> str:
    """Create a new knowledge base article.

    Args:
        title: Article title.
        slug: URL-friendly slug.
        category: One of: Standard Operating Procedure, System Documentation, Developer Documentation, Troubleshooting Guide, General Knowledge, Template.
        content: Article body in markdown.
        identifier: Optional identifier like DOC-001, SOP-099 (auto-assigned if omitted).
    """
    payload = {
        "title": title,
        "slug": slug,
        "category": category,
        "content": _unescape(content),
    }
    if identifier:
        payload["identifier"] = identifier
    result = await client.post("/articles", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
async def article_update(
    article_id: str,
    title: str | None = None,
    content: str | None = None,
    identifier: str | None = None,
) -> str:
    """Update an article (full replacement of provided fields).

    Args:
        article_id: UUID of the article.
        title: New title (optional).
        content: New content in markdown (optional).
        identifier: New identifier like DOC-001, SOP-099 (optional).
    """
    payload = {}
    if title is not None:
        payload["title"] = title
    if content is not None:
        payload["content"] = _unescape(content)
    if identifier is not None:
        payload["identifier"] = identifier
    result = await client.put(f"/articles/{article_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
async def article_update_section(
    article_id: str,
    section_heading: str,
    content: str,
) -> str:
    """Update a single section of an article without replacing the entire content.

    Args:
        article_id: UUID of the article.
        section_heading: Exact heading string (e.g. '## Environment & Auth').
        content: New section body in markdown (do NOT include the heading line).
    """
    payload = {
        "heading": section_heading,
        "content": _unescape(content),
    }
    result = await client.patch(f"/articles/{article_id}/sections", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=LIGHT_READ)
async def article_sections(article_id: str) -> str:
    """List all section headings in an article.

    Args:
        article_id: UUID or slug of the article.
    """
    result = await client.get(f"/articles/{article_id}/sections")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=LIGHT_READ)
async def article_read_section(
    article_id: str,
    section_heading: str,
    index: int = 0,
) -> str:
    """Read a single section of an article by heading.

    Args:
        article_id: UUID or slug of the article.
        section_heading: Exact heading string (e.g. '## Environment & Auth').
        index: Disambiguation index for duplicate headings (default 0).
    """
    result = await client.get(
        f"/articles/{article_id}/sections",
        params={"section": section_heading, "index": index},
    )
    return json.dumps(result, indent=2)


@mcp.tool(annotations=LIGHT_READ)
async def article_history(article_id: str, page_size: int = 10) -> str:
    """List version history for an article.

    Args:
        article_id: UUID of the article.
        page_size: Number of entries to return (default 10).
    """
    result = await client.get(
        f"/articles/{article_id}/history", params={"page_size": page_size}
    )
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
async def article_revert(
    article_id: str,
    history_id: str,
) -> str:
    """Revert an article to a previous version.

    Args:
        article_id: UUID of the article.
        history_id: UUID of the history entry to revert to.
    """
    result = await client.post(f"/articles/{article_id}/revert/{history_id}")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
async def article_relate(article_id: str, related_article_id: str) -> str:
    """Link two articles together.

    Args:
        article_id: UUID of the source article.
        related_article_id: UUID of the related article.
    """
    payload = {"related_id": related_article_id}
    result = await client.post(f"/articles/{article_id}/relations", json=payload)
    return json.dumps(result, indent=2)
