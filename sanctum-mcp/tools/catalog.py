"""MCP tools for Sanctum product/service catalog."""

import json
from decimal import Decimal
from app import mcp
from cost_tiers import HEAVY_IDEMPOTENT, HEAVY_WRITE, LIGHT_READ, STANDARD_READ
from telemetry import with_telemetry
import client


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def product_list(product_type: str | None = None) -> str:
    """List all products/services in the catalog.

    Args:
        product_type: Optional filter by product type (e.g. 'service', 'product').
    """
    params = {}
    if product_type:
        params["product_type"] = product_type
    result = await client.get("/products", params=params or None)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=STANDARD_READ)
@with_telemetry("standard")
async def product_show(product_id: str, expand: str | None = None) -> str:
    """Show details for a single product/service.

    Args:
        product_id: UUID of the product.
        expand: Comma-separated fields to expand, 'all', or 'none'. No expandable fields defined yet — parameter accepted for forward compatibility.
    """
    params = {}
    if expand is not None:
        params["expand"] = expand
    result = await client.get(f"/products/{product_id}", params=params or None)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def product_create(
    name: str,
    type: str,
    unit_price: float,
    description: str | None = None,
    is_recurring: bool = False,
    billing_frequency: str | None = None,
) -> str:
    """Create a new product or service in the catalog.

    Args:
        name: Product/service name.
        type: Product type (e.g. 'service', 'hardware', 'hosting', 'license').
        unit_price: Unit price in dollars.
        description: Optional description.
        is_recurring: Whether this is a recurring charge (default false).
        billing_frequency: Billing frequency if recurring (e.g. 'monthly', 'yearly', 'quarterly').
    """
    payload: dict = {
        "name": name,
        "type": type,
        "unit_price": unit_price,
    }
    if description is not None:
        payload["description"] = description
    if is_recurring:
        payload["is_recurring"] = True
    if billing_frequency is not None:
        payload["billing_frequency"] = billing_frequency
    result = await client.post("/products", json=payload)
    return json.dumps(result, indent=2)


@mcp.tool(annotations=HEAVY_IDEMPOTENT)
@with_telemetry("heavy")
async def product_update(
    product_id: str,
    name: str | None = None,
    type: str | None = None,
    unit_price: float | None = None,
    description: str | None = None,
    is_recurring: bool | None = None,
    billing_frequency: str | None = None,
) -> str:
    """Update an existing product or service.

    Args:
        product_id: UUID of the product to update.
        name: New name (optional).
        type: New type (optional).
        unit_price: New unit price (optional).
        description: New description (optional).
        is_recurring: Update recurring flag (optional).
        billing_frequency: Update billing frequency (optional).
    """
    payload: dict = {}
    if name is not None:
        payload["name"] = name
    if type is not None:
        payload["type"] = type
    if unit_price is not None:
        payload["unit_price"] = unit_price
    if description is not None:
        payload["description"] = description
    if is_recurring is not None:
        payload["is_recurring"] = is_recurring
    if billing_frequency is not None:
        payload["billing_frequency"] = billing_frequency
    result = await client.put(f"/products/{product_id}", json=payload)
    return json.dumps(result, indent=2)
