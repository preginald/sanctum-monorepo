"""Health endpoint data for Sanctum MCP server."""

import time

_start_time = time.time()

# Lazily discovered session manager reference (set by _handle_health on first call)
_session_manager = None
_session_manager_searched = False
