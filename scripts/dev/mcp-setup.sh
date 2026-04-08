#!/usr/bin/env bash
# Configure a single MCP server entry per consumer context.
#
# Instead of 8 separate entries (one per agent), we register ONE entry
# per Claude consumer (Code, Chat, etc.) with a shared Bearer token
# for the auth gate, and an X-Sanctum-Agent header for identity.
#
# The MCP server's AgentIdentityMiddleware resolves X-Sanctum-Agent to
# the correct per-agent Core API token via SANCTUM_TOKEN_* env vars.
#
# Also exports SANCTUM_TOKEN_* env vars into the server's .env from
# the per-agent .env.<agent> files.
#
# Usage: scripts/dev/mcp-setup.sh

set -euo pipefail

MCP_DIR="$(cd "$(dirname "$0")/../../sanctum-mcp" && pwd)"
MCP_URL="http://localhost:8100"
MCP_ENV="$MCP_DIR/.env"

# Agent identity -> env file mapping
declare -A AGENTS=(
    [architect]="$MCP_DIR/.env.architect"
    [operator]="$MCP_DIR/.env.operator"
    [oracle]="$MCP_DIR/.env.oracle"
    [surgeon]="$MCP_DIR/.env.surgeon"
    [sentinel]="$MCP_DIR/.env.sentinel"
    [scribe]="$MCP_DIR/.env.scribe"
)

read_token() {
    local env_file="$1"
    if [[ ! -f "$env_file" ]]; then
        echo "ERROR: $env_file not found — run generate_service_tokens.py first" >&2
        return 1
    fi
    grep '^SANCTUM_API_TOKEN=' "$env_file" | cut -d= -f2
}

# ── Step 1: Inject SANCTUM_TOKEN_* into server .env ──────────────────

echo "Injecting agent tokens into $MCP_ENV..."

# Remove any existing SANCTUM_TOKEN_* lines
if [[ -f "$MCP_ENV" ]]; then
    # Use temp file to avoid sed -i portability issues
    grep -v '^SANCTUM_TOKEN_' "$MCP_ENV" > "$MCP_ENV.tmp" || true
    mv "$MCP_ENV.tmp" "$MCP_ENV"
fi

for agent in architect operator oracle surgeon sentinel scribe; do
    token="$(read_token "${AGENTS[$agent]}")" || continue
    echo "SANCTUM_TOKEN_${agent^^}=$token" >> "$MCP_ENV"
    echo "  SANCTUM_TOKEN_${agent^^} loaded from .env.$agent"
done

# ── Step 2: Read the shared auth token (operator token) ──────────────

SHARED_TOKEN="$(read_token "${AGENTS[operator]}")" || {
    echo "ERROR: Cannot read operator token for shared auth" >&2
    exit 1
}

# ── Step 3: Remove old per-agent entries ─────────────────────────────

echo ""
echo "Removing old per-agent MCP entries..."
for name in sanctum-oracle sanctum-operator sanctum-architect sanctum-surgeon sanctum-sentinel sanctum-scribe sanctum-chat sanctum-code; do
    claude mcp remove "$name" 2>/dev/null && echo "  Removed $name" || true
done

# Also remove the new consolidated entry if re-running
claude mcp remove sanctum 2>/dev/null || true

# ── Step 4: Register single entry with identity header ───────────────

# Determine the agent name for this consumer context.
# Default to sanctum-operator (Code context). Override with $SANCTUM_AGENT.
AGENT_NAME="${SANCTUM_AGENT:-sanctum-operator}"

echo ""
echo "Registering single MCP entry: sanctum -> $MCP_URL"
echo "  Auth: shared Bearer token (operator)"
echo "  Identity: X-Sanctum-Agent: $AGENT_NAME"

claude mcp remove sanctum 2>/dev/null || true
claude mcp add sanctum "$MCP_URL" -t http \
    -H "Authorization: Bearer $SHARED_TOKEN" \
    -H "X-Sanctum-Agent: $AGENT_NAME"

echo ""
echo "Done. Start the MCP server with: scripts/dev/mcp-server.sh start"
echo ""
echo "To register with a different agent identity:"
echo "  SANCTUM_AGENT=sanctum-surgeon scripts/dev/mcp-setup.sh"
