"""Sanctum MCP Server — exposes Sanctum Core API as MCP tools for Claude Code."""

import os
from dotenv import load_dotenv

load_dotenv()

from app import mcp  # noqa: E402
from starlette.middleware import Middleware  # noqa: E402
from auth import OAuthMiddleware  # noqa: E402

# Register tool modules (side-effect imports)
import tools.tickets  # noqa: E402, F401
import tools.articles  # noqa: E402, F401
import tools.milestones  # noqa: E402, F401
import tools.search  # noqa: E402, F401
import tools.invoices  # noqa: E402, F401
import tools.projects  # noqa: E402, F401
import tools.artefacts  # noqa: E402, F401
import tools.catalog  # noqa: E402, F401

if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "streamable-http")
    host = os.getenv("MCP_HOST", "0.0.0.0")
    port = int(os.getenv("MCP_PORT", "8100"))
    reload = os.getenv("MCP_RELOAD", "").lower() in ("1", "true", "yes")
    uvicorn_opts = {}
    if reload:
        uvicorn_opts["reload"] = True
        uvicorn_opts["reload_dirs"] = [os.path.dirname(os.path.abspath(__file__))]
    mcp.run(
        transport=transport,
        host=host,
        port=port,
        path="/",
        middleware=[Middleware(OAuthMiddleware)],
        uvicorn_config=uvicorn_opts,
    )
