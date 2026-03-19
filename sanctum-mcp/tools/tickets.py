"""MCP tools for Sanctum ticket operations."""

import json
from app import mcp
import client


def _unescape(s: str | None) -> str | None:
    """Unescape literal \\n sequences from MCP string arguments."""
    if s is None:
        return s
    return s.replace("\\n", "\n")


@mcp.tool()
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


@mcp.tool()
async def ticket_show(ticket_id: int) -> str:
    """Show details for a single ticket by ID."""
    result = await client.get(f"/tickets/{ticket_id}")
    return json.dumps(result, indent=2)


@mcp.tool()
async def ticket_create(
    subject: str,
    project_id: str,
    account_id: str = "dbc2c7b9-d8c2-493f-a6ed-527f7d191068",
    milestone_id: str | None = None,
    ticket_type: str = "task",
    priority: str = "normal",
    description: str | None = None,
) -> str:
    """Create a new ticket.

    Args:
        subject: Ticket subject line.
        project_id: UUID of the project.
        account_id: UUID of the account (defaults to Digital Sanctum HQ).
        milestone_id: UUID of the milestone (optional).
        ticket_type: One of: support, bug, feature, refactor, task, access, maintenance, alert, hotfix, test.
        priority: One of: low, normal, high, critical.
        description: Ticket description in markdown.
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
    result = await client.post("/tickets", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
async def ticket_update(
    ticket_id: int,
    subject: str | None = None,
    description: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    ticket_type: str | None = None,
    milestone_id: str | None = None,
    resolution_comment_id: str | None = None,
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
    result = await client.put(f"/tickets/{ticket_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
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


@mcp.tool()
async def ticket_resolve(
    ticket_id: int,
    body: str | None = None,
    comment_id: str | None = None,
) -> str:
    """Resolve a ticket with a linked resolution comment.

    Either provide body (creates a new resolution comment) or comment_id
    (uses an existing comment as the resolution). One of the two is required.

    Args:
        ticket_id: The ticket number.
        body: Resolution text in markdown (creates a new comment).
        comment_id: UUID of an existing comment to use as the resolution.
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
    result = await client.put(f"/tickets/{ticket_id}", json=ticket_payload)
    return json.dumps(result, indent=2)


@mcp.tool()
async def ticket_relate_article(ticket_id: int, article_id: str) -> str:
    """Link an article to a ticket.

    Args:
        ticket_id: The ticket number.
        article_id: UUID of the article.
    """
    result = await client.post(f"/tickets/{ticket_id}/articles/{article_id}")
    return json.dumps(result, indent=2)


@mcp.tool()
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


@mcp.tool()
async def ticket_unrelate_article(ticket_id: int, article_id: str) -> str:
    """Remove an article link from a ticket.

    Args:
        ticket_id: The ticket number.
        article_id: UUID of the article to unlink.
    """
    result = await client.delete(f"/tickets/{ticket_id}/articles/{article_id}")
    return json.dumps(result, indent=2)


@mcp.tool()
async def ticket_unrelate_ticket(ticket_id: int, related_ticket_id: int) -> str:
    """Remove a link between two tickets.

    Args:
        ticket_id: The source ticket number.
        related_ticket_id: The target ticket number to unlink.
    """
    result = await client.delete(f"/tickets/{ticket_id}/relations/{related_ticket_id}")
    return json.dumps(result, indent=2)


@mcp.tool()
async def ticket_delete(ticket_id: int) -> str:
    """Soft-delete (archive) a ticket.

    Args:
        ticket_id: The ticket number.
    """
    result = await client.delete(f"/tickets/{ticket_id}")
    return json.dumps(result, indent=2)
