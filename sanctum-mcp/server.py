"""Sanctum MCP Server — exposes Sanctum Core API as MCP tools for Claude Code."""

import os
from dotenv import load_dotenv

load_dotenv()

from app import mcp  # noqa: E402

# Register tool modules (side-effect imports)
import tools.tickets  # noqa: E402, F401
import tools.articles  # noqa: E402, F401
import tools.milestones  # noqa: E402, F401
import tools.search  # noqa: E402, F401
import tools.invoices  # noqa: E402, F401
import tools.projects  # noqa: E402, F401
import tools.artefacts  # noqa: E402, F401

if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "streamable-http")
    host = os.getenv("MCP_HOST", "0.0.0.0")
    port = int(os.getenv("MCP_PORT", "8100"))
    mcp.run(transport=transport, host=host, port=port)
