"""Token-aware guard for large document fetches.

Uses section count as a size proxy to avoid fetching full content of large
documents into the MCP context window. When a document exceeds the configured
section threshold, returns a section listing with a routing hint instead of
the full content.

Known limitation: unstructured artefacts (zero markdown headings) bypass the
guard because they cannot be surgically fetched via section-level reads.
"""

import logging
import os

import client

log = logging.getLogger(__name__)

MCP_SECTION_THRESHOLD = int(os.getenv("MCP_SECTION_THRESHOLD", "8"))


def _wants_content(expand: str | None) -> bool:
    """Return True if the expand parameter will include content."""
    if expand is None:
        return False
    lower = expand.lower().strip()
    if lower == "none":
        return False
    if lower == "all":
        return True
    return "content" in [f.strip() for f in lower.split(",")]


async def guard_fetch(
    entity_type: str,
    entity_id: str,
    expand: str | None,
    force: bool = False,
) -> str | None:
    """Pre-flight guard for article_show / artefact_show.

    If expand includes 'content' (or 'all') AND section count >= threshold,
    returns a JSON string with the sections list and a routing hint.
    Otherwise returns None, meaning the caller should proceed with the normal
    full fetch.

    Args:
        entity_type: 'article' or 'artefact'.
        entity_id: Slug (article) or UUID (artefact).
        expand: The expand parameter from the tool call.
        force: If True, bypass the guard entirely (for callers that need
               full content regardless of size).

    Returns:
        JSON string with sections + routing hint if guarded, else None.
    """
    if force:
        return None

    if not _wants_content(expand):
        return None

    # Fetch section headings via the lightweight sections endpoint.
    import json

    if entity_type == "article":
        sections_path = f"/articles/{entity_id}/sections"
        read_tool = "article_read_section"
    elif entity_type == "artefact":
        sections_path = f"/artefacts/{entity_id}/sections"
        read_tool = "artefact_read_section"
    else:
        return None

    try:
        sections = await client.get(sections_path)
    except Exception:
        # If sections endpoint fails, let the normal fetch proceed.
        log.warning(
            "token_guard: failed to fetch sections for %s %s, bypassing guard",
            entity_type,
            entity_id,
        )
        return None

    section_list = sections if isinstance(sections, list) else []
    section_count = len(section_list)

    if section_count < MCP_SECTION_THRESHOLD:
        log.debug(
            "token_guard: %s %s has %d sections (threshold %d), allowing full fetch",
            entity_type,
            entity_id,
            section_count,
            MCP_SECTION_THRESHOLD,
        )
        return None

    # Guard activated -- return sections with routing hint.
    log.info(
        "token_guard: GUARDED %s %s -- %d sections (threshold %d), returning section list",
        entity_type,
        entity_id,
        section_count,
        MCP_SECTION_THRESHOLD,
    )

    return json.dumps(
        {
            "guarded": True,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "section_count": section_count,
            "threshold": MCP_SECTION_THRESHOLD,
            "sections": section_list,
            "hint": (
                f"Document has {section_count} sections (exceeds threshold of "
                f"{MCP_SECTION_THRESHOLD}). Use {read_tool} to fetch specific "
                f"sections instead of loading the full content."
            ),
        },
        indent=2,
    )
