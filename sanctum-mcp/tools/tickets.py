"""MCP tools for Sanctum ticket operations."""

import json
from app import mcp
import client


@mcp.tool()
async def ticket_list(
    project: str | None = None,
    milestone: str | None = None,
    status: str | None = None,
) -> str:
    """List tickets, optionally filtered by project, milestone, or status."""
    params = {}
    if project:
        params["project"] = project
    if milestone:
        params["milestone"] = milestone
    if status:
        params["status"] = status
    result = await client.get("/tickets", params=params)
    return json.dumps(result, indent=2)


@mcp.tool()
async def ticket_show(ticket_id: int) -> str:
    """Show details for a single ticket by ID."""
    result = await client.get(f"/tickets/{ticket_id}")
    return json.dumps(result, indent=2)


@mcp.tool()
async def ticket_create(
    subject: str,
    project_id: str,
    milestone_id: str | None = None,
    ticket_type: str = "task",
    priority: str = "normal",
    description: str | None = None,
) -> str:
    """Create a new ticket.

    Args:
        subject: Ticket subject line.
        project_id: UUID of the project.
        milestone_id: UUID of the milestone (optional).
        ticket_type: One of: support, bug, feature, refactor, task, access, maintenance, alert, hotfix, test.
        priority: One of: low, normal, high, critical.
        description: Ticket description in markdown.
    """
    payload = {
        "subject": subject,
        "project_id": project_id,
        "ticket_type": ticket_type,
        "priority": priority,
    }
    if milestone_id:
        payload["milestone_id"] = milestone_id
    if description:
        payload["description"] = description
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
    """
    payload = {}
    if subject is not None:
        payload["subject"] = subject
    if description is not None:
        payload["description"] = description
    if status is not None:
        payload["status"] = status
    if priority is not None:
        payload["priority"] = priority
    if ticket_type is not None:
        payload["ticket_type"] = ticket_type
    if milestone_id is not None:
        payload["milestone_id"] = milestone_id
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
        "body": body,
        "visibility": visibility,
        "entity_type": "ticket",
        "entity_id": str(ticket_id),
    }
    result = await client.post("/comments", json=payload)
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
        "related_ticket_id": related_ticket_id,
        "relation_type": relation_type,
    }
    result = await client.post(f"/tickets/{ticket_id}/relations", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
async def ticket_delete(ticket_id: int) -> str:
    """Soft-delete (archive) a ticket.

    Args:
        ticket_id: The ticket number.
    """
    result = await client.delete(f"/tickets/{ticket_id}")
    return json.dumps(result, indent=2)
