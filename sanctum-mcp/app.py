"""FastMCP app instance — imported by tool modules and server entrypoint."""

from fastmcp import FastMCP

mcp = FastMCP(
    "Sanctum",
    instructions="""\
Sanctum Core MCP server. Provides tools for managing tickets, articles, \
milestones, invoices, and search in the Sanctum ERP/MSP/CRM platform.

When working with tool results, write down any important information you might \
need later in your response, as the original tool result may be cleared later.

Key UUIDs:
- Digital Sanctum HQ account: dbc2c7b9-d8c2-493f-a6ed-527f7d191068
- Sanctum Core project: 335650e8-1a85-4263-9a25-4cf2ca55fb79

Ticket workflow:
- ticket_create requires project_id (UUID). Use search to find project/milestone UUIDs.
- To resolve a ticket: first ticket_update with status="resolved", then ticket_comment \
with the resolution body. This is the two-step resolve flow.
- ticket_list fetches all tickets and filters client-side. Use filters (project, \
milestone, status) and limit to keep responses concise.

Article workflow:
- article_show accepts slug or identifier (e.g. "DOC-009", "SOP-099").
- article_update_section patches a single section without replacing the full article. \
Pass the exact heading string (e.g. "## Environment & Auth") and body content without \
the heading line.

Search:
- search does cross-entity fuzzy search. Use entity_type to scope results \
(ticket, wiki, client, milestone, project, product, contact, asset).

Milestones:
- milestone_list and milestone_create require project_id (UUID).
""",
)
