#!/bin/bash
#
# sanctum-api-health.sh — Health probe for sanctum-api.service
#
# Runs every 30s via sanctum-api-health.timer. Checks:
#   1. API availability (GET /health)
#   2. Rolling restart count (3+ in 10 min → alert)
#   3. Memory pressure (RSS >80% of MemoryMax → alert)
#
# Alerts are sent via Sanctum Notify API.
#
# Fails silently on transient errors (curl timeout, etc.) so systemd
# does not interpret a failed health check as a service fault.

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────
API_NAME="sanctum-api"
API_HEALTH_URL="http://localhost:8000/health"
API_SYSTEM_HEALTH_URL="http://localhost:8000/system/health"
NOTIFY_URL="${NOTIFY_URL:-http://localhost:8100/api/notify}"
NOTIFY_TOKEN="${SANCTUM_TOKEN_OPERATOR:-}"
MEMORY_MAX_MB=768
RESTART_THRESHOLD=3
RESTART_WINDOW_SEC=600  # 10 minutes
STATE_FILE="/tmp/sanctum-api-restarts.json"

# ── Helpers ───────────────────────────────────────────────────────────

log()  { echo "[sanctum-api-health] $(date -Iseconds) $*"; }
warn() { log "WARN $*"; }
info() { log "INFO $*"; }

notify_alert() {
    local subject="$1" message="$2"
    if [ -z "$NOTIFY_TOKEN" ]; then
        warn "No NOTIFY_TOKEN set — skipping alert: $subject"
        return
    fi
    curl -sf -X POST "$NOTIFY_URL" \
        -H "Authorization: Bearer $NOTIFY_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"template\":\"infra_alert\",\"to\":\"admin\",\"subject\":\"$subject\",\"body\":\"$message\"}" \
        > /dev/null 2>&1 || warn "Failed to send Notify alert: $subject"
}

# ── 1. API Availability ───────────────────────────────────────────────

if ! curl -sf --max-time 5 "$API_HEALTH_URL" > /dev/null 2>&1; then
    n_restarts=$(systemctl show "$API_NAME" --property=NRestarts --value 2>/dev/null || echo "0")
    warn "API unreachable (NRestarts=$n_restarts)"
    # Don't alert on every 30s failure — the restart alert will fire if it cycled
    exit 0
fi

# ── 2. Rolling Restart Count ──────────────────────────────────────────

current_restarts=$(systemctl show "$API_NAME" --property=NRestarts --value 2>/dev/null || echo "0")
now=$(date +%s)

# Load state file (track restarts with timestamps)
if [ -f "$STATE_FILE" ]; then
    state=$(cat "$STATE_FILE")
else
    state='{"last_known_restarts":0,"events":[]}'
fi

last_known=$(echo "$state" | python3 -c "import json,sys; print(json.load(sys.stdin).get('last_known_restarts',0))" 2>/dev/null || echo "0")
events=$(echo "$state" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin).get('events',[])))" 2>/dev/null || echo "[]")

# Detect new restart
if [ "$current_restarts" -gt "$last_known" ]; then
    new_count=$((current_restarts - last_known))
    for _ in $(seq 1 "$new_count"); do
        events=$(echo "$events" | python3 -c "
import json,sys
ev=json.load(sys.stdin)
ev.append($now)
# Keep only events within the rolling window
cutoff=$now - $RESTART_WINDOW_SEC
ev=[e for e in ev if e > cutoff]
print(json.dumps(ev))
" 2>/dev/null || echo "$events")
    done
    info "Detected restart: $last_known → $current_restarts"
fi

# Count events in the rolling window
event_count=$(echo "$events" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$event_count" -ge "$RESTART_THRESHOLD" ]; then
    notify_alert \
        "OOM/Crash Loop Detected: $API_NAME" \
        "$API_NAME restarted $event_count times in the last ${RESTART_WINDOW_SEC}s window (threshold: $RESTART_THRESHOLD). Current NRestarts: $current_restarts. Runbook: SOP-134 — VPS Service Recovery Runbook."
    warn "RESTART ALERT: $event_count restarts in rolling window"
    # Prevent re-alerting by clearing the event window
    events="[]"
fi

# Persist state
echo "$events" | python3 -c "
import json,sys
with open('$STATE_FILE','w') as f:
    json.dump({'last_known_restarts': $current_restarts, 'events': json.load(sys.stdin)}, f)
" 2>/dev/null || warn "Failed to write state file"

# ── 3. Memory Pressure ────────────────────────────────────────────────

mem_json=$(curl -sf --max-time 5 "$API_SYSTEM_HEALTH_URL" 2>/dev/null || echo "")
if [ -n "$mem_json" ]; then
    mem_pct=$(echo "$mem_json" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print(d.get('system',{}).get('memory_percent',0))
except: print(0)
" 2>/dev/null || echo "0")

    # memory_percent from psutil is system-wide; compare against our MemoryMax budget
    mem_threshold_pct=$((MEMORY_MAX_MB * 80 / 100))
    # Read actual RSS from cgroup if available
    rss_mb=0
    if [ -f /sys/fs/cgroup/memory/system.slice/$API_NAME.service/memory.current ]; then
        rss_bytes=$(cat /sys/fs/cgroup/memory/system.slice/$API_NAME.service/memory.current 2>/dev/null || echo "0")
        rss_mb=$((rss_bytes / 1048576))
    fi

    if [ "$rss_mb" -gt 0 ] && [ "$rss_mb" -gt "$mem_threshold_pct" ]; then
        pct=$((rss_mb * 100 / MEMORY_MAX_MB))
        notify_alert \
            "High Memory: $API_NAME" \
            "$API_NAME RSS is ${rss_mb}MB (${pct}% of ${MEMORY_MAX_MB}MB budget). Threshold: 80%. Runbook: SOP-134 — VPS Service Recovery Runbook."
        warn "MEMORY ALERT: ${rss_mb}MB RSS (${pct}% of budget)"
    fi
fi

info "OK (restarts=$current_restarts, window_events=$event_count)"
