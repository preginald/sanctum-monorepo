"""MCP tools for Sanctum template operations."""

import json
from app import mcp
from cost_tiers import DESTRUCTIVE, HEAVY_IDEMPOTENT, HEAVY_WRITE, LIGHT_READ, STANDARD_READ
from telemetry import with_telemetry
import client

DS_HQ = "dbc2c7b9-d8c2-493f-a6ed-527f7d191068"


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def template_list(
    template_type: str | None = None,
    category: str | None = None,
) -> str:
    """List available project templates (active by default).

    Args:
        template_type: Filter by type (e.g. "project", "ticket").
        category: Filter by category (e.g. "general", "audit").
    """
    params = {}
    if template_type:
        params["template_type"] = template_type
    if category:
        params["category"] = category
    result = await client.get("/templates", params=params or None)
    if isinstance(result, list):
        summary = [
            {
                "id": t.get("id"),
                "name": t.get("name"),
                "description": t.get("description"),
                "template_type": t.get("template_type"),
                "category": t.get("category"),
                "is_active": t.get("is_active"),
                "section_count": t.get("section_count"),
                "item_count": t.get("item_count"),
                "times_applied": t.get("times_applied"),
            }
            for t in result
        ]
        return json.dumps(summary, indent=2)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def template_apply(
    template_id: str,
    account_id: str = DS_HQ,
    project_id: str | None = None,
    project_name: str | None = None,
    project_description: str | None = None,
    variables: dict[str, str] | None = None,
) -> str:
    """Apply a project template, scaffolding milestones and tickets.

    Only template_type="project" is supported. Pass project_id to apply to an
    existing project (milestones are appended after existing ones), or omit to
    create a new project. project_name and project_description are ignored when
    project_id is provided.

    Args:
        template_id: UUID of the template to apply.
        account_id: UUID of the account (defaults to Digital Sanctum HQ).
        project_id: UUID of an existing project. Omit to create a new one.
        project_name: Name for the new project (ignored when project_id set).
        project_description: Description for the new project (ignored when project_id set).
        variables: Optional dict of placeholder substitutions (e.g. {"service_name": "Foo"}).
    """
    payload = {"account_id": account_id}
    if project_id:
        payload["project_id"] = project_id
    if project_name:
        payload["project_name"] = project_name
    if project_description:
        payload["project_description"] = project_description
    if variables:
        payload["variables"] = variables
    result = await client.post(f"/templates/{template_id}/apply", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=STANDARD_READ)
@with_telemetry("standard")
async def template_show(template_id: str) -> str:
    """Show a template with its full section and item tree.

    Args:
        template_id: UUID of the template.
    """
    result = await client.get(f"/templates/{template_id}")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def template_create(
    name: str,
    template_type: str,
    description: str | None = None,
    category: str = "general",
    tags: list[str] | None = None,
    icon: str | None = None,
    sections: list[dict] | None = None,
) -> str:
    """Create a new template with optional nested sections and items.

    Each section dict should have: name (required), description, sequence, items.
    Each item dict should have: subject (required), description, item_type, priority, sequence, config.

    Args:
        name: Template name.
        template_type: One of: project, ticket, deal, campaign.
        description: Optional description.
        category: Category string (default "general").
        tags: Optional list of tag strings.
        icon: Optional icon identifier.
        sections: Optional list of section dicts with nested item dicts.
    """
    payload = {"name": name, "template_type": template_type, "category": category}
    if description is not None:
        payload["description"] = description
    if tags is not None:
        payload["tags"] = tags
    if icon is not None:
        payload["icon"] = icon
    if sections is not None:
        payload["sections"] = sections
    result = await client.post("/templates", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def template_update(
    template_id: str,
    name: str | None = None,
    description: str | None = None,
    category: str | None = None,
    tags: list[str] | None = None,
    icon: str | None = None,
    is_active: bool | None = None,
) -> str:
    """Update template metadata. Only provided fields are changed.

    Note: template_type is immutable after creation and cannot be changed.

    Args:
        template_id: UUID of the template.
        name: New name.
        description: New description.
        category: New category.
        tags: New list of tags (replaces existing).
        icon: New icon identifier.
        is_active: Set active/inactive status.
    """
    payload = {}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if category is not None:
        payload["category"] = category
    if tags is not None:
        payload["tags"] = tags
    if icon is not None:
        payload["icon"] = icon
    if is_active is not None:
        payload["is_active"] = is_active
    result = await client.put(f"/templates/{template_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def template_section_create(
    template_id: str,
    name: str,
    description: str | None = None,
    sequence: int | None = None,
) -> str:
    """Create a new section under a template.

    Args:
        template_id: UUID of the parent template.
        name: Section name.
        description: Optional section description.
        sequence: Optional ordering sequence (default 1 server-side).
    """
    payload = {
        k: v
        for k, v in {
            "name": name,
            "description": description,
            "sequence": sequence,
        }.items()
        if v is not None
    }
    result = await client.post(f"/templates/{template_id}/sections", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def template_section_update(
    template_id: str,
    section_id: str,
    name: str | None = None,
    description: str | None = None,
    sequence: int | None = None,
) -> str:
    """Update a template section. Only provided fields are changed.

    Args:
        template_id: UUID of the parent template (for caller clarity; not
            forwarded to the Core API — the section_id is sufficient).
        section_id: UUID of the section to update.
        name: New section name.
        description: New section description.
        sequence: New ordering sequence.
    """
    payload = {
        k: v
        for k, v in {
            "name": name,
            "description": description,
            "sequence": sequence,
        }.items()
        if v is not None
    }
    result = await client.put(f"/templates/sections/{section_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=DESTRUCTIVE)
@with_telemetry("heavy")
async def template_section_delete(template_id: str, section_id: str) -> str:
    """Delete a section from a template.

    WARNING: This is a hard delete. All items under this section are
    cascade-deleted by the database (models.py line 795-796 configures
    `cascade="all, delete-orphan"` on TemplateSection.items). There is
    no soft-delete and no confirmation guard on the Core API.

    Args:
        template_id: UUID of the parent template (for caller clarity; not
            forwarded to the Core API — the section_id is sufficient).
        section_id: UUID of the section to delete.
    """
    result = await client.delete(f"/templates/sections/{section_id}")
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def template_item_create(
    template_id: str,
    section_id: str,
    subject: str,
    description: str | None = None,
    item_type: str = "task",
    priority: str = "normal",
    sequence: int | None = None,
    config: dict | None = None,
) -> str:
    """Create a new item under a template section.

    Args:
        template_id: UUID of the parent template (for caller clarity; not
            forwarded to the Core API — the section_id is sufficient).
        section_id: UUID of the parent section.
        subject: Item subject line.
        description: Optional item description.
        item_type: Item type (default "task").
        priority: Item priority (default "normal").
        sequence: Optional ordering sequence (default 1 server-side).
        config: Optional JSON config dict.
    """
    payload = {
        k: v
        for k, v in {
            "subject": subject,
            "description": description,
            "item_type": item_type,
            "priority": priority,
            "sequence": sequence,
            "config": config,
        }.items()
        if v is not None
    }
    result = await client.post(
        f"/templates/sections/{section_id}/items", json=payload
    )
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def template_item_update(
    template_id: str,
    item_id: str,
    subject: str | None = None,
    description: str | None = None,
    item_type: str | None = None,
    priority: str | None = None,
    sequence: int | None = None,
    config: dict | None = None,
) -> str:
    """Update a template item. Only provided fields are changed.

    Args:
        template_id: UUID of the parent template (for caller clarity; not
            forwarded to the Core API — the item_id is sufficient).
        item_id: UUID of the item to update.
        subject: New item subject.
        description: New item description.
        item_type: New item type.
        priority: New item priority.
        sequence: New ordering sequence.
        config: New JSON config dict.
    """
    payload = {
        k: v
        for k, v in {
            "subject": subject,
            "description": description,
            "item_type": item_type,
            "priority": priority,
            "sequence": sequence,
            "config": config,
        }.items()
        if v is not None
    }
    result = await client.put(f"/templates/items/{item_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=DESTRUCTIVE)
@with_telemetry("heavy")
async def template_item_delete(template_id: str, item_id: str) -> str:
    """Delete an item from a template section.

    WARNING: This is a hard delete. There is no soft-delete and no
    confirmation guard on the Core API.

    Args:
        template_id: UUID of the parent template (for caller clarity; not
            forwarded to the Core API — the item_id is sufficient).
        item_id: UUID of the item to delete.
    """
    result = await client.delete(f"/templates/items/{item_id}")
    return json.dumps(result, indent=2)
