"""MCP tools for Sanctum product/service catalog."""

import json
from app import mcp
import client


@mcp.tool()
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


@mcp.tool()
async def product_show(product_id: str) -> str:
    """Show details for a single product/service.

    Args:
        product_id: UUID of the product.
    """
    result = await client.get(f"/products/{product_id}")
    return json.dumps(result, indent=2)
