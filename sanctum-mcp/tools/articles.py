"""MCP tools for Sanctum article (wiki) operations."""

import json
from app import mcp
import client


def _unescape(s: str | None) -> str | None:
    """Unescape literal \\n sequences from MCP string arguments."""
    if s is None:
        return s
    return s.replace("\\n", "\n")


@mcp.tool()
async def article_list() -> str:
    """List all articles in the knowledge base."""
    result = await client.get("/articles")
    return json.dumps(result, indent=2)


@mcp.tool()
async def article_show(slug: str) -> str:
    """Show an article by slug or identifier (e.g. DOC-009, SOP-099).

    Args:
        slug: Article slug or identifier.
    """
    result = await client.get(f"/articles/{slug}")
    return json.dumps(result, indent=2)


@mcp.tool()
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


@mcp.tool()
async def article_update(
    article_id: str,
    title: str | None = None,
    content: str | None = None,
) -> str:
    """Update an article (full replacement of provided fields).

    Args:
        article_id: UUID of the article.
        title: New title (optional).
        content: New content in markdown (optional).
    """
    payload = {}
    if title is not None:
        payload["title"] = title
    if content is not None:
        payload["content"] = _unescape(content)
    result = await client.put(f"/articles/{article_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
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


@mcp.tool()
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


@mcp.tool()
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


@mcp.tool()
async def article_relate(article_id: str, related_article_id: str) -> str:
    """Link two articles together.

    Args:
        article_id: UUID of the source article.
        related_article_id: UUID of the related article.
    """
    payload = {"related_id": related_article_id}
    result = await client.post(f"/articles/{article_id}/relations", json=payload)
    return json.dumps(result, indent=2)
