"""MCP tool for pushing mockup artefacts to tickets."""

import json
import re
from app import mcp
from cost_tiers import HEAVY_WRITE
from telemetry import with_telemetry
import client

# Robust extension mapping from mime_type to file extension
_EXT_MAP = {
    "text/jsx": ".jsx",
    "text/tsx": ".tsx",
    "text/html": ".html",
    "text/css": ".css",
    "application/json": ".json",
    "text/javascript": ".js",
    "text/typescript": ".ts",
}


def _slugify(label: str) -> str:
    """Convert a version label to a filename-safe slug."""
    slug = label.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug or "mockup"


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def mockup_push(
    source: str,
    ticket_id: int,
    version_label: str,
    mime_type: str = "text/jsx",
    design_system_refs: list[str] | None = None,
) -> str:
    """Push a mockup source file to a ticket as an artefact with handoff comment.

    Creates an artefact containing the mockup source code, links it to the
    specified ticket, and posts a structured handoff comment with integration
    instructions.

    Args:
        source: The full source code of the mockup component.
        ticket_id: The ticket number to attach the mockup to.
        version_label: Human-readable version label (e.g. "v1-light-tailwind").
        mime_type: MIME type of the source (default "text/jsx").
        design_system_refs: Optional list of design system reference strings
            (e.g. ["Tailwind CSS", "shadcn/ui"]).
    """
    # 1. Derive filename from version_label
    slug = _slugify(version_label)
    ext = _EXT_MAP.get(mime_type, ".jsx")
    filename = f"{slug}{ext}"

    # 2. Create artefact
    artefact_payload = {
        "name": f"Mockup: {version_label} (#{ticket_id})",
        "artefact_type": "document",
        "category": "mockup",
        "content": source,
        "mime_type": mime_type,
        "sensitivity": "internal",
    }
    artefact_result = await client.post("/artefacts", json=artefact_payload)
    artefact_id = artefact_result.get("id")
    if not artefact_id:
        return json.dumps({
            "error": "Failed to create artefact",
            "detail": artefact_result,
        }, indent=2)

    # 3. Link artefact to ticket
    link_payload = {
        "entity_type": "ticket",
        "entity_id": str(ticket_id),
    }
    link_ok = True
    try:
        await client.post(f"/artefacts/{artefact_id}/link", json=link_payload)
    except Exception:
        link_ok = False

    # 4. Build handoff comment
    ds_section = ""
    if design_system_refs:
        refs = ", ".join(design_system_refs)
        ds_section = f"\n**Design system:** {refs}\n"

    comment_body = (
        f"## Mockup Handoff -- {version_label}\n\n"
        f"**Artefact:** `{artefact_id}`\n"
        f"**File:** `mockups/{filename}`\n"
        f"**MIME:** `{mime_type}`\n"
        f"{ds_section}"
        f"\n### Integration Steps\n\n"
        f"1. Save artefact content to `mockups/{filename}`\n"
        f"2. Install any missing dependencies from the design system refs\n"
        f"3. Wire up routing / embed in target page\n"
        f"4. Replace placeholder data with live API calls\n"
    )

    # 5. Post comment to ticket
    comment_payload = {
        "body": comment_body,
        "visibility": "internal",
        "ticket_id": ticket_id,
    }
    comment_result = await client.post("/comments", json=comment_payload)
    comment_id = comment_result.get("id")

    # 6. Return summary
    result = {
        "artefact_id": artefact_id,
        "comment_id": comment_id,
        "filename": filename,
        "version_label": version_label,
        "ticket_id": ticket_id,
    }
    if not link_ok:
        result["warning"] = "Artefact created but link to ticket failed"
    return json.dumps(result, indent=2)
