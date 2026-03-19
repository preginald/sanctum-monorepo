"""MCP tools for Sanctum invoice operations."""

import json
from app import mcp
import client


@mcp.tool()
async def invoice_show(invoice_id: str) -> str:
    """Show details for an invoice.

    Args:
        invoice_id: UUID of the invoice.
    """
    result = await client.get(f"/invoices/{invoice_id}")
    return json.dumps(result, indent=2)


@mcp.tool()
async def invoice_create(
    account_id: str,
    description: str | None = None,
    status: str = "draft",
    amount: float | None = None,
) -> str:
    """Create a new invoice.

    Args:
        account_id: UUID of the client account.
        description: Invoice description.
        status: One of: draft, sent, paid, overdue, void.
        amount: Invoice amount.
    """
    payload = {"account_id": account_id, "status": status}
    if description:
        payload["description"] = description
    if amount is not None:
        payload["amount"] = amount
    result = await client.post("/invoices", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
async def invoice_update(
    invoice_id: str,
    status: str | None = None,
    description: str | None = None,
    amount: float | None = None,
) -> str:
    """Update an invoice.

    Args:
        invoice_id: UUID of the invoice.
        status: One of: draft, sent, paid, overdue, void.
        description: Invoice description.
        amount: Invoice amount.
    """
    payload = {}
    if status is not None:
        payload["status"] = status
    if description is not None:
        payload["description"] = description
    if amount is not None:
        payload["amount"] = amount
    result = await client.put(f"/invoices/{invoice_id}", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool()
async def invoice_delete(invoice_id: str) -> str:
    """Delete an invoice.

    Args:
        invoice_id: UUID of the invoice.
    """
    result = await client.delete(f"/invoices/{invoice_id}")
    return json.dumps(result, indent=2)
