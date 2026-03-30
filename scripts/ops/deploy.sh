#!/bin/bash
# ==============================================================================
# deploy.sh — Single-command production deployment for Sanctum Core
# Ticket: #387
# ==============================================================================

set -e

REMOTE="sanctum-prod"
APP_DIR="$HOME/DigitalSanctum"
SERVICE_API="sanctum-api"
SERVICE_MCP="sanctum-mcp"
LOG_DIR="/var/log/sanctum"
LOG_FILE="$LOG_DIR/deploy.log"
DRY_RUN=false

# --- Flags ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --agent) REMOTE="sanctum-agent"; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

run() {
    if [ "$DRY_RUN" = true ]; then
        echo "  [dry-run] $*"
    else
        "$@"
    fi
}

remote() {
    if [ "$DRY_RUN" = true ]; then
        echo "  [dry-run] ssh $REMOTE: $*"
    else
        ssh "$REMOTE" "$@"
    fi
}

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       SANCTUM CORE — DEPLOY SCRIPT       ║"
echo "╚══════════════════════════════════════════╝"
[ "$DRY_RUN" = true ] && echo "  ⚠ DRY RUN MODE — no changes will be made"
echo ""

# --- 1. Check SSH ---
echo "→ Checking SSH connection..."
remote "echo ok" > /dev/null 2>&1 && echo "  ✓ SSH connection OK" || { echo "  ✗ Cannot reach $REMOTE"; exit 1; }

# --- 2. Git pull (ff-only) ---
echo "→ Capturing current commit..."
OLD_COMMIT=$(remote "cd $APP_DIR && git rev-parse HEAD 2>&1")
echo "→ Pulling latest code..."
PULL_OUTPUT=$(remote "cd $APP_DIR && git pull --ff-only origin main 2>&1")
echo "  $PULL_OUTPUT"
UP_TO_DATE=false
if echo "$PULL_OUTPUT" | grep -q "Already up to date"; then
    echo "  ✓ Already up to date"
    UP_TO_DATE=true
elif echo "$PULL_OUTPUT" | grep -qi "error\|fatal\|conflict"; then
    echo "  ✗ Git pull failed — aborting"
    exit 1
else
    echo "  ✓ Code updated"
fi

# --- 2.5. Determine changed directories ---
RESTART_API=false
RESTART_MCP=false
if [ "$UP_TO_DATE" = false ]; then
    CHANGED_FILES=$(remote "cd $APP_DIR && git diff --name-only $OLD_COMMIT HEAD 2>&1")
    echo "→ Changed files since last deploy:"
    echo "  $CHANGED_FILES"
    if echo "$CHANGED_FILES" | grep -q '^sanctum-core/'; then
        RESTART_API=true
    fi
    if echo "$CHANGED_FILES" | grep -q '^sanctum-mcp/'; then
        RESTART_MCP=true
    fi
fi

# --- 3. Check pending migrations ---
echo "→ Checking migrations..."
MIGRATION_STATUS=$(remote "cd $APP_DIR/sanctum-core && source venv/bin/activate && alembic current 2>&1")
PENDING=$(remote "cd $APP_DIR/sanctum-core && source venv/bin/activate && alembic heads 2>&1")
echo "  Current: $MIGRATION_STATUS"
echo "  Head:    $PENDING"

if [ "$DRY_RUN" = false ] && [ "$MIGRATION_STATUS" != "$PENDING" ]; then
    echo "  ⚠ Pending migrations detected"
    read -rp "  Apply migrations? [y/N] " confirm
    [ "$confirm" != "y" ] && { echo "  Aborted."; exit 1; }
    echo "→ Applying migrations..."
    run remote "cd $APP_DIR/sanctum-core && source venv/bin/activate && alembic upgrade head 2>&1" \
        || { echo "  ✗ Migration failed — aborting (service NOT restarted)"; exit 1; }
    echo "  ✓ Migrations applied"
else
    echo "  ✓ Schema up to date"
fi

# --- 4. Install dependencies ---
echo "→ Installing backend dependencies..."
run remote "cd $APP_DIR/sanctum-core && source venv/bin/activate && pip install -r requirements.txt -q 2>&1"
echo "  ✓ Backend dependencies OK"

# --- 5. Build frontend ---
echo "→ Building frontend..."
run remote "cd $APP_DIR/sanctum-web && npm install --silent && npm run build 2>&1 | tail -3"
echo "  ✓ Frontend built"

# --- 6. Conditional service restarts (#764) ---
if [ "$RESTART_API" = true ]; then
    echo "→ Restarting $SERVICE_API (sanctum-core/ changed)..."
    run remote "sudo systemctl restart $SERVICE_API"
    echo "  ✓ $SERVICE_API restarted"
else
    echo "→ Skipping $SERVICE_API restart (no sanctum-core/ changes)"
fi
if [ "$RESTART_MCP" = true ]; then
    echo "→ Restarting $SERVICE_MCP (sanctum-mcp/ changed)..."
    run remote "sudo systemctl restart $SERVICE_MCP"
    echo "  ✓ $SERVICE_MCP restarted"
else
    echo "→ Skipping $SERVICE_MCP restart (no sanctum-mcp/ changes)"
fi

# --- 7. Health check ---
echo "→ Running health check..."
sleep 2
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://core.digitalsanctum.com.au/api/system/health 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    echo "  ✓ Health check passed (HTTP $HTTP_STATUS)"
else
    echo "  ✗ Health check failed (HTTP $HTTP_STATUS) — check logs: journalctl -u $SERVICE_API"
    exit 1
fi

# --- 8. Log deployment ---
COMMIT=$(remote "cd $APP_DIR && git rev-parse --short HEAD 2>&1")
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
LOG_ENTRY="[$TIMESTAMP] commit=$COMMIT status=success"
run remote "mkdir -p $LOG_DIR && echo '$LOG_ENTRY' >> $LOG_FILE"
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         ✓ DEPLOYMENT COMPLETE            ║"
echo "╚══════════════════════════════════════════╝"
echo "  Commit:    $COMMIT"
echo "  Timestamp: $TIMESTAMP"
echo ""
