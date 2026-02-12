#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$HOME/Documents/sanctum_context_${TIMESTAMP}.md"
PROD_IP="159.223.82.75"
PROD_USER="preginald"
REMOTE_ENV="/home/preginald/DigitalSanctum/sanctum-core/.env"
HANDOVER_FILE="session_handover.md"

# --- SSH MULTIPLEXING SETUP ---
# Create a unique socket file in a temporary directory
SOCKET="/tmp/ssh_mux_${TIMESTAMP}"

echo "Establishing secure tunnel to Production..."
# Start a master connection in the background (-M -f -N)
ssh -M -S "$SOCKET" -f -N -o ControlPersist=600 $PROD_USER@$PROD_IP
# This is where you enter the password ONCE.

# Create an alias function to wrap the ssh command with the socket
ssh_prod() {
    ssh -S "$SOCKET" $PROD_USER@$PROD_IP "$@"
}
# ------------------------------

echo "Generating Phoenix Payload..."

{
    echo "# SYSTEM CONTEXT INJECTION"
    echo "Generated: $(date)"
    echo ""

    if [ -f "$HANDOVER_FILE" ]; then
        echo "## 0. SESSION HANDOVER (CURRENT STATE)"
        cat "$HANDOVER_FILE"
        echo ""
    fi

    echo "## 1. CARTOGRAPHY (Local)"
    tree -L 4 -I 'node_modules|venv|.venv|dist|.git|__pycache__|*.log|*.pyc'
    echo ""

    echo "## 2. PRODUCTION INTRANET MANIFEST"
    echo "| ID | Category | Title | Version |"
    echo "| :--- | :--- | :--- | :--- |"

    ssh_prod "grep 'DATABASE_URL' $REMOTE_ENV | cut -d '=' -f2- | xargs -I {} psql {} -t -A -F ' | ' -c \"SELECT identifier, category, title, version FROM articles ORDER BY category, identifier;\"" | sed 's/^/| /; s/$/ |/'
    echo ""

    echo "## 3. PROJECT CONTEXT: $(ssh_prod "grep 'DATABASE_URL' $REMOTE_ENV | cut -d '=' -f2- | xargs -I {} psql {} -t -c \"SELECT name FROM projects WHERE id = '335650e8-1a85-4263-9a25-4cf2ca55fb79';\"" | xargs)"

    echo "| Milestone Name |"
    echo "| :--- |"

    ssh_prod "grep 'DATABASE_URL' $REMOTE_ENV | cut -d '=' -f2- | xargs -I {} psql {} -t -A -F ' | ' -c \"SELECT name FROM milestones WHERE project_id = '335650e8-1a85-4263-9a25-4cf2ca55fb79' ORDER BY created_at ASC;\"" | sed 's/^/| /; s/$/ |/'
    echo ""

    echo "## 4. CORE CODEBASE"
    echo "### app/models.py"; cat sanctum-core/app/models.py
    echo "### src/lib/constants.js"; cat sanctum-web/src/lib/constants.js
} > "$OUTPUT_FILE"

# Clean up: Close the master connection
ssh -S "$SOCKET" -O exit $PROD_USER@$PROD_IP

if [[ "$OSTYPE" == "darwin"* ]]; then pbcopy < "$OUTPUT_FILE"; else xclip -selection clipboard < "$OUTPUT_FILE"; fi
echo "✅ Continuity Payload copied to clipboard."
