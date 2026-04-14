#!/usr/bin/env bash
# Configure MCP server entries for all agent identities.
#
# Registers one entry per agent identity (sanctum-architect, sanctum-operator,
# etc.), each pointing at the same server with a shared Bearer token for the
# auth gate and a per-agent X-Sanctum-Agent header for identity.
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
    [chat]="$MCP_DIR/.env.chat"
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

for agent in architect operator oracle surgeon sentinel scribe chat; do
    token="$(read_token "${AGENTS[$agent]}")" || continue
    echo "SANCTUM_TOKEN_${agent^^}=$token" >> "$MCP_ENV"
    echo "  SANCTUM_TOKEN_${agent^^} loaded from .env.$agent"
done

# ── Step 2: Read the shared auth token (operator token) ──────────────

SHARED_TOKEN="$(read_token "${AGENTS[operator]}")" || {
    echo "ERROR: Cannot read operator token for shared auth" >&2
    exit 1
}

# ── Step 3: Remove old entries (per-agent and legacy aliases) ────────

echo ""
echo "Removing old MCP entries..."
for name in sanctum-oracle sanctum-operator sanctum-architect sanctum-surgeon sanctum-sentinel sanctum-scribe sanctum-chat sanctum-code sanctum; do
    claude mcp remove "$name" 2>/dev/null && echo "  Removed $name" || true
done

# ── Step 4: Register one entry per agent identity ────────────────────

echo ""
echo "Registering per-agent MCP entries -> $MCP_URL"
echo "  Auth: shared Bearer token (operator)"
echo ""

for agent in architect operator oracle surgeon sentinel scribe chat; do
    entry_name="sanctum-$agent"
    claude mcp add "$entry_name" "$MCP_URL" -t http \
        -H "Authorization: Bearer $SHARED_TOKEN" \
        -H "X-Sanctum-Agent: $entry_name"
    echo "  Registered $entry_name (X-Sanctum-Agent: $entry_name)"
done

echo ""
echo "Done. 7 entries registered (7 x 64 = 448 tool defs)."
echo "Start the MCP server with: scripts/dev/mcp-server.sh start"
