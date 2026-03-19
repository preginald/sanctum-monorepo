"""FastMCP app instance — imported by tool modules and server entrypoint."""

from fastmcp import FastMCP

mcp = FastMCP(
    "Sanctum",
    instructions=(
        "Sanctum Core MCP server. Provides tools for managing tickets, articles, "
        "milestones, invoices, and search in the Sanctum ERP/MSP/CRM platform."
    ),
)
