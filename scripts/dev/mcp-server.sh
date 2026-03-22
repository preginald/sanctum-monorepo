#!/usr/bin/env bash
# Start/stop the Sanctum MCP server (single process).
#
# Agent identity is determined by the Bearer token each Claude Code
# MCP entry sends — no need for multiple server processes.
#
# The server itself uses no API token (passthrough mode).
# Configure agent tokens with: scripts/dev/mcp-setup.sh
#
# Usage: scripts/dev/mcp-server.sh [start|stop|status]

set -euo pipefail

MCP_DIR="$(cd "$(dirname "$0")/../../sanctum-mcp" && pwd)"
PID_FILE="/tmp/sanctum-mcp.pid"
PORT="${MCP_PORT:-8100}"

start_server() {
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "MCP server already running on port $PORT (PID $(cat "$PID_FILE"))"
        return 0
    fi

    cd "$MCP_DIR"
    MCP_PORT="$PORT" MCP_AUTH_ENABLED=false MCP_RELOAD=true \
        "$MCP_DIR/venv/bin/python" "$MCP_DIR/server.py" &
    local pid=$!
    echo "$pid" > "$PID_FILE"
    echo "MCP server started on port $PORT (PID $pid)"
}

stop_server() {
    if [[ -f "$PID_FILE" ]]; then
        local pid
        pid="$(cat "$PID_FILE")"
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo "MCP server stopped (PID $pid)"
        else
            echo "MCP server not running (stale PID file)"
        fi
        rm -f "$PID_FILE"
    else
        echo "MCP server not running"
    fi
}

status_server() {
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "MCP server: running on port $PORT (PID $(cat "$PID_FILE"))"
    else
        echo "MCP server: stopped"
    fi
}

case "${1:-start}" in
    start)   start_server ;;
    stop)    stop_server ;;
    restart) stop_server; start_server ;;
    status)  status_server ;;
    *)
        echo "Usage: $0 [start|stop|restart|status]"
        exit 1
        ;;
esac
