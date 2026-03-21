#!/usr/bin/env bash
# Configure named MCP servers for all 6 agent identities.
#
# Each agent gets its own named MCP server entry in Claude Code,
# pointing at the same single MCP server process but with a unique
# Bearer token for identity attribution.
#
# Reads tokens from sanctum-mcp/.env.* files.
# Run AFTER generate_service_tokens.py has created all tokens.
#
# Usage: scripts/dev/mcp-setup.sh

set -euo pipefail

MCP_DIR="$(cd "$(dirname "$0")/../../sanctum-mcp" && pwd)"
MCP_URL="http://localhost:8100"

# Agent identity → env file mapping
declare -A AGENTS=(
    [sanctum-oracle]="$MCP_DIR/.env.oracle"
    [sanctum-operator]="$MCP_DIR/.env.operator"
    [sanctum-architect]="$MCP_DIR/.env.architect"
    [sanctum-surgeon]="$MCP_DIR/.env.surgeon"
    [sanctum-sentinel]="$MCP_DIR/.env.sentinel"
    [sanctum-scribe]="$MCP_DIR/.env.scribe"
)

# Backward-compat aliases (point to same tokens)
declare -A ALIASES=(
    [sanctum-chat]="$MCP_DIR/.env.oracle"
    [sanctum-code]="$MCP_DIR/.env.operator"
)

read_token() {
    local env_file="$1"
    if [[ ! -f "$env_file" ]]; then
        echo "ERROR: $env_file not found — run generate_service_tokens.py first" >&2
        return 1
    fi
    grep '^SANCTUM_API_TOKEN=' "$env_file" | cut -d= -f2
}

setup_mcp() {
    local name="$1" env_file="$2"
    local token
    token="$(read_token "$env_file")" || return 1

    # Remove existing entry if present
    claude mcp remove "$name" 2>/dev/null || true

    # Add with Bearer token header (name then URL as positional args)
    claude mcp add "$name" "$MCP_URL" -t http \
        -H "Authorization: Bearer $token"

    echo "  $name → $MCP_URL (token from $(basename "$env_file"))"
}

echo "Configuring MCP servers pointing at $MCP_URL..."
echo ""

echo "Agent identities:"
for name in sanctum-oracle sanctum-operator sanctum-architect sanctum-surgeon sanctum-sentinel sanctum-scribe; do
    setup_mcp "$name" "${AGENTS[$name]}"
done

echo ""
echo "Backward-compat aliases:"
for name in sanctum-chat sanctum-code; do
    setup_mcp "$name" "${ALIASES[$name]}"
done

echo ""
echo "Done. Start the MCP server with: scripts/dev/mcp-server.sh start"
