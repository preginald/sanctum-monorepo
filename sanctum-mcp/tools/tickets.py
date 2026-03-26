"""MCP tools for Sanctum ticket operations."""

import json
import re
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


def _unescape(s: str | None) -> str | None:
    """Unescape literal \\n sequences from MCP string arguments."""
    if s is None:
        return s
    return s.replace("\\n", "\n")


def _compute_delivery_hints(ticket: dict) -> list[str]:
    """Compute delivery hints for a ticket based on its current state."""
    hints = []

    # No linked articles (check list or count field)
    articles = ticket.get("articles") or []
    article_count = ticket.get("article_count", len(articles))
    if article_count == 0:
        hints.append("No linked articles — consider linking relevant KB articles with ticket_relate_article.")

    # Acceptance criteria analysis
    description = ticket.get("description") or ""
    unchecked = len(re.findall(r"- \[ \]", description))
    checked = len(re.findall(r"- \[x\]", description, re.IGNORECASE))
    total = checked + unchecked
    if total == 0:
        hints.append("No acceptance criteria found — description has no checkbox items (- [ ] / - [x]).")
    elif unchecked > 0:
        hints.append(f"Acceptance criteria: {checked} of {total} checked.")

    # Resolved without resolution comment
    if ticket.get("status") == "resolved" and not ticket.get("resolution_comment_id"):
        hints.append("No resolution comment — ticket is resolved but has no linked resolution comment.")

    return hints


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def ticket_list(
    project: str | None = None,
    milestone: str | None = None,
    status: str | None = None,
    limit: int = 50,
) -> str:
    """List tickets, optionally filtered by project, milestone, or status.

    Args:
        project: Filter by project name (substring match).
        milestone: Filter by milestone name (substring match).
        status: Filter by status: new, open, pending, qa, resolved.
        limit: Max results to return (default 50).
    """
    result = await client.get("/tickets")
    tickets = result if isinstance(result, list) else []

    if project:
        p = project.lower()
        tickets = [t for t in tickets if p in (t.get("project_name") or "").lower()]
    if milestone:
        m = milestone.lower()
        tickets = [t for t in tickets if m in (t.get("milestone_name") or "").lower()]
    if status:
        tickets = [t for t in tickets if t.get("status") == status]

    # Return summary fields only to keep response concise
    summary = []
    for t in tickets[:limit]:
        summary.append({
            "id": t["id"],
            "subject": t["subject"],
            "status": t["status"],
            "priority": t["priority"],
            "ticket_type": t.get("ticket_type"),
            "project_name": t.get("project_name"),
            "milestone_name": t.get("milestone_name"),
            "account_name": t.get("account_name"),
            "created_at": t.get("created_at"),
        })
    return json.dumps(summary, indent=2)


@mcp.tool(annotations=STANDARD_READ)
@with_telemetry("standard")
async def ticket_show(ticket_id: int, quiet: bool = False, expand: str | None = None) -> str:
    """Show details for a single ticket by ID.

    Args:
        ticket_id: The ticket number.
        quiet: Set true to suppress delivery hints (useful for batch operations). Also sets expand=none if expand is not explicitly provided.
        expand: Comma-separated fields to expand (comments,articles,artefacts,time_entries,materials,related_tickets,transitions,description,resolution), 'all', or 'none'. Overrides quiet when both are provided.
    """
    # Determine the expand param to send to the API
    api_expand = expand
    if api_expand is None and quiet:
        api_expand = "none"

    # For delivery hints we need description — ensure it's fetched even if
    # the caller didn't request it, then strip it after computing hints.
    need_hints = not quiet
    hint_injected_description = False
    if need_hints and api_expand is not None and api_expand != "all":
        fields = {f.strip() for f in api_expand.split(",") if f.strip()}
        if "description" not in fields:
            fields.add("description")
            hint_injected_description = True
            api_expand = ",".join(sorted(fields))

    params = {}
    if api_expand is not None:
        params["expand"] = api_expand

    result = await client.get(f"/tickets/{ticket_id}", params=params or None)

    if need_hints and isinstance(result, dict):
        result["delivery_hints"] = _compute_delivery_hints(result)
        # If we injected description solely for hints, strip it from output
        if hint_injected_description:
            result.pop("description", None)
            result.pop("resolved_description", None)

    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def ticket_create(
    subject: str,
    project_id: str,
    account_id: str = "dbc2c7b9-d8c2-493f-a6ed-527f7d191068",
    milestone_id: str | None = None,
    ticket_type: str = "task",
    priority: str = "normal",
    description: str | None = None,
    skip_validation: bool = False,
    quiet: bool = False,
) -> str:
    """Create a new ticket.

    ticket_create requires project_id (UUID). Use search to find project/milestone UUIDs.

    Description is validated against the template for the ticket type. All 10 types require template-conforming descriptions: feature=DOC-016, bug=DOC-013, task=DOC-014, refactor=DOC-015, hotfix=DOC-057, support=DOC-058, alert=DOC-059, access=DOC-060, maintenance=DOC-061, test=DOC-062.

    Args:
        subject: Ticket subject line.
        project_id: UUID of the project.
        account_id: UUID of the account (defaults to Digital Sanctum HQ).
        milestone_id: UUID of the milestone (optional).
        ticket_type: One of: support, bug, feature, refactor, task, access, maintenance, alert, hotfix, test.
        priority: One of: low, normal, high, critical.
        description: Ticket description in markdown. Must conform to type template (see DOC-013-016, DOC-057-062).
        skip_validation: Set true to bypass description template validation.
        quiet: Set true to suppress guidance messages (useful for batch operations).
    """
    payload = {
        "subject": subject,
        "project_id": project_id,
        "account_id": account_id,
        "ticket_type": ticket_type,
        "priority": priority,
    }
    if milestone_id:
        payload["milestone_id"] = milestone_id
    if description:
        payload["description"] = _unescape(description)
    if skip_validation:
        payload["skip_validation"] = True
    result = await client.post("/tickets", json=payload)
    if not quiet and isinstance(result, dict) and result.get("id"):
        result["guidance"] = "Link relevant articles with ticket_relate_article."
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def ticket_update(
    ticket_id: int,
    subject: str | None = None,
    description: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    ticket_type: str | None = None,
    milestone_id: str | None = None,
    resolution_comment_id: str | None = None,
    no_billable: bool = False,
    no_billable_reason: str | None = None,
    skip_validation: bool = False,
) -> str:
    """Update an existing ticket. Only provided fields are changed.

    Args:
        ticket_id: The ticket number.
        subject: New subject line.
        description: New description in markdown.
        status: One of: new, open, pending, qa, resolved.
        priority: One of: low, normal, high, critical.
        ticket_type: One of: support, bug, feature, refactor, task, access, maintenance, alert, hotfix, test.
        milestone_id: UUID of the milestone.
        resolution_comment_id: UUID of the comment to link as resolution.
        no_billable: Mark ticket as non-billable for invoice filtering (default false). Does not bypass the billable item gate.
        no_billable_reason: Required justification when no_billable is true.
        skip_validation: Set true to bypass all resolve-time validation gates.
    """
    payload = {}
    if subject is not None:
        payload["subject"] = subject
    if description is not None:
        payload["description"] = _unescape(description)
    if status is not None:
        payload["status"] = status
    if priority is not None:
        payload["priority"] = priority
    if ticket_type is not None:
        payload["ticket_type"] = ticket_type
    if milestone_id is not None:
        payload["milestone_id"] = milestone_id
    if resolution_comment_id is not None:
        payload["resolution_comment_id"] = resolution_comment_id
    if no_billable:
        payload["no_billable"] = True
        payload["no_billable_reason"] = no_billable_reason
    if skip_validation:
        payload["skip_validation"] = True
    result = await client.put(f"/tickets/{ticket_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def ticket_comment(
    ticket_id: int,
    body: str,
    visibility: str = "internal",
) -> str:
    """Add a comment to a ticket.

    Args:
        ticket_id: The ticket number.
        body: Comment text in markdown.
        visibility: One of: internal, public.
    """
    payload = {
        "body": _unescape(body),
        "visibility": visibility,
        "ticket_id": ticket_id,
    }
    result = await client.post("/comments", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def ticket_resolve(
    ticket_id: int,
    body: str | None = None,
    comment_id: str | None = None,
    no_billable: bool = False,
    no_billable_reason: str | None = None,
    skip_validation: bool = False,
) -> str:
    """Resolve a ticket with a linked resolution comment.

    Either provide body (creates a new resolution comment) or comment_id
    (uses an existing comment as the resolution). One of the two is required.

    Args:
        ticket_id: The ticket number.
        body: Resolution text in markdown (creates a new comment).
        comment_id: UUID of an existing comment to use as the resolution.
        no_billable: Mark ticket as non-billable for invoice filtering (default false). Does not bypass the billable item gate.
        no_billable_reason: Required justification when no_billable is true.
        skip_validation: Bypass all resolve-time validation gates (default false).
    """
    if not body and not comment_id:
        return json.dumps({"error": "Either body or comment_id is required"})
    if body and comment_id:
        return json.dumps({"error": "Provide body or comment_id, not both"})

    resolution_text = None
    resolution_cid = None

    if body:
        # Step 1a: Create the resolution comment
        comment_payload = {
            "body": _unescape(body),
            "visibility": "internal",
            "ticket_id": ticket_id,
        }
        comment_result = await client.post("/comments", json=comment_payload)
        resolution_cid = comment_result.get("id")
        resolution_text = _unescape(body)
        if not resolution_cid:
            return json.dumps({"error": "Failed to create resolution comment", "detail": comment_result})
    else:
        # Step 1b: Fetch existing comment to get body text
        comments = await client.get(f"/comments?ticket_id={ticket_id}")
        comment = next((c for c in comments if c.get("id") == comment_id), None)
        if not comment:
            return json.dumps({"error": f"Comment {comment_id} not found on ticket #{ticket_id}"})
        resolution_cid = comment_id
        resolution_text = comment.get("body", "")

    # Step 2: Update ticket with status=resolved + resolution fields
    ticket_payload = {
        "status": "resolved",
        "resolution": resolution_text,
        "resolution_comment_id": resolution_cid,
    }
    if no_billable:
        ticket_payload["no_billable"] = True
        ticket_payload["no_billable_reason"] = no_billable_reason
    if skip_validation:
        ticket_payload["skip_validation"] = True
    result = await client.put(f"/tickets/{ticket_id}", json=ticket_payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def ticket_relate_article(ticket_id: int, article_id: str) -> str:
    """Link an article to a ticket.

    Args:
        ticket_id: The ticket number.
        article_id: UUID of the article.
    """
    result = await client.post(f"/tickets/{ticket_id}/articles/{article_id}")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def ticket_relate_ticket(
    ticket_id: int,
    related_ticket_id: int,
    relation_type: str = "relates_to",
) -> str:
    """Link two tickets together.

    Args:
        ticket_id: The source ticket number.
        related_ticket_id: The target ticket number.
        relation_type: One of: relates_to, blocks, duplicates.
    """
    payload = {
        "related_id": related_ticket_id,
        "relation_type": relation_type,
    }
    result = await client.post(f"/tickets/{ticket_id}/relations", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def ticket_unrelate_article(ticket_id: int, article_id: str) -> str:
    """Remove an article link from a ticket.

    Args:
        ticket_id: The ticket number.
        article_id: UUID of the article to unlink.
    """
    result = await client.delete(f"/tickets/{ticket_id}/articles/{article_id}")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def ticket_unrelate_ticket(ticket_id: int, related_ticket_id: int) -> str:
    """Remove a link between two tickets.

    Args:
        ticket_id: The source ticket number.
        related_ticket_id: The target ticket number to unlink.
    """
    result = await client.delete(f"/tickets/{ticket_id}/relations/{related_ticket_id}")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=DESTRUCTIVE)
@with_telemetry("destructive")
async def ticket_delete(ticket_id: int) -> str:
    """Soft-delete (archive) a ticket.

    Args:
        ticket_id: The ticket number.
    """
    result = await client.delete(f"/tickets/{ticket_id}")
    return json.dumps(result, indent=2)


# ── Time Entry Tools ──────────────────────────────────────────────


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def time_entry_create(
    ticket_id: int,
    start_time: str,
    end_time: str,
    description: str | None = None,
    product_id: str | None = None,
) -> str:
    """Create a time entry on a ticket.

    The backend enforces a 15-minute minimum billing increment (BUS-001 D4).
    Times must be ISO 8601 format (e.g. '2026-03-20T10:00:00+11:00').

    Args:
        ticket_id: The ticket number.
        start_time: Start time in ISO 8601 format.
        end_time: End time in ISO 8601 format.
        description: Optional description of work performed.
        product_id: Optional UUID of the billable product/service.
    """
    payload: dict = {
        "start_time": start_time,
        "end_time": end_time,
    }
    if description is not None:
        payload["description"] = description
    if product_id is not None:
        payload["product_id"] = product_id
    result = await client.post(f"/tickets/{ticket_id}/time_entries", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def time_entry_update(
    entry_id: str,
    start_time: str | None = None,
    end_time: str | None = None,
    description: str | None = None,
    product_id: str | None = None,
) -> str:
    """Update an existing time entry.

    Args:
        entry_id: UUID of the time entry.
        start_time: New start time in ISO 8601 format (optional).
        end_time: New end time in ISO 8601 format (optional).
        description: New description (optional).
        product_id: New product/service UUID (optional).
    """
    payload: dict = {}
    if start_time is not None:
        payload["start_time"] = start_time
    if end_time is not None:
        payload["end_time"] = end_time
    if description is not None:
        payload["description"] = description
    if product_id is not None:
        payload["product_id"] = product_id
    result = await client.put(f"/time_entries/{entry_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=DESTRUCTIVE)
@with_telemetry("destructive")
async def time_entry_delete(ticket_id: int, entry_id: str) -> str:
    """Delete a time entry from a ticket.

    Args:
        ticket_id: The ticket number.
        entry_id: UUID of the time entry to delete.
    """
    result = await client.delete(f"/tickets/{ticket_id}/time_entries/{entry_id}")
    return json.dumps(result, indent=2)
