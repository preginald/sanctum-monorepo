#!/usr/bin/env bash
# Start dual MCP servers for agent roster:
#   sanctum-chat (port 8100) — Claude Chat identity, used by reviewer + writer
#   sanctum-code (port 8101) — Claude Code identity, used by implementer + qa
#
# Reads tokens from sanctum-mcp/.env.chat and .env.code
#
# Usage: scripts/dev/mcp-dual.sh [start|stop|status]

set -euo pipefail

MCP_DIR="$(cd "$(dirname "$0")/../../sanctum-mcp" && pwd)"
CHAT_PID_FILE="/tmp/sanctum-mcp-chat.pid"
CODE_PID_FILE="/tmp/sanctum-mcp-code.pid"

read_token() {
    local env_file="$1"
    if [[ ! -f "$env_file" ]]; then
        echo "ERROR: $env_file not found" >&2
        exit 1
    fi
    grep '^SANCTUM_API_TOKEN=' "$env_file" | cut -d= -f2
}

start_server() {
    local name="$1" port="$2" token="$3" pid_file="$4"

    if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "$name already running (PID $(cat "$pid_file"))"
        return 0
    fi

    cd "$MCP_DIR"
    SANCTUM_API_TOKEN="$token" MCP_PORT="$port" MCP_AUTH_ENABLED=false \
        "$MCP_DIR/venv/bin/python" "$MCP_DIR/server.py" &
    local pid=$!
    echo "$pid" > "$pid_file"
    echo "$name started on port $port (PID $pid)"
}

stop_server() {
    local name="$1" pid_file="$2"

    if [[ -f "$pid_file" ]]; then
        local pid
        pid="$(cat "$pid_file")"
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo "$name stopped (PID $pid)"
        else
            echo "$name not running (stale PID file)"
        fi
        rm -f "$pid_file"
    else
        echo "$name not running"
    fi
}

status_server() {
    local name="$1" pid_file="$2" port="$3"

    if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "$name: running on port $port (PID $(cat "$pid_file"))"
    else
        echo "$name: stopped"
    fi
}

case "${1:-start}" in
    start)
        CHAT_TOKEN="$(read_token "$MCP_DIR/.env.chat")"
        CODE_TOKEN="$(read_token "$MCP_DIR/.env.code")"
        start_server "sanctum-chat" 8100 "$CHAT_TOKEN" "$CHAT_PID_FILE"
        start_server "sanctum-code" 8101 "$CODE_TOKEN" "$CODE_PID_FILE"
        ;;
    stop)
        stop_server "sanctum-chat" "$CHAT_PID_FILE"
        stop_server "sanctum-code" "$CODE_PID_FILE"
        ;;
    status)
        status_server "sanctum-chat" "$CHAT_PID_FILE" 8100
        status_server "sanctum-code" "$CODE_PID_FILE" 8101
        ;;
    *)
        echo "Usage: $0 [start|stop|status]"
        exit 1
        ;;
esac
