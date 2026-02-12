#!/bin/bash

# DS-SOP-101 Helper: Phoenix Initial Boot Payload
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="/tmp/phoenix_boot_${TIMESTAMP}.md"
HANDOVER_FILE="session_handover.md"

echo "🔥 Generating Phoenix Boot Payload..."

{
    echo "# 🏗️ PHOENIX SYSTEM CONTEXT INJECTION"
    echo "Generated: $(date)"
    echo "Project Root: $(pwd)"
    echo ""
    
    # 1. SESSION HANDOVER (If you have an active task list)
    if [ -f "$HANDOVER_FILE" ]; then
        echo "## 0. CURRENT SESSION STATE"
        echo '```markdown'
        cat "$HANDOVER_FILE"
        echo '```'
        echo ""
    fi

    # 2. CARTOGRAPHY (The Map)
    echo "## 1. PROJECT CARTOGRAPHY"
    echo '```text'
    # Show structure but exclude the noise
    tree -L 3 -I 'node_modules|venv|.venv|dist|.git|__pycache__|*.log|*.pyc|static|tests'
    echo '```'
    echo ""
    
    # 3. CORE DNA (The Logic)
    # We use scopy here to handle the formatting/highlighting for us
    echo "## 2. CORE CODEBASE DNA"
    echo ""
    
    # Selecting the 4 most critical "Anchor" files based on your tree:
    # 1. Models (Database Schema)
    # 2. Main (API Entry/Middleware)
    # 3. API Lib (Frontend communication)
    # 4. Auth (Security context)
    
    # Note: We use 'bash' to run scopy inside the block to append to our output
    # but we redirect scopy's clipboard copy to null so it doesn't overwrite yet.
    
    files=(
        "sanctum-core/app/models.py"
        "sanctum-core/app/main.py"
        "sanctum-web/src/lib/api.js"
        "sanctum-core/app/auth.py"
    )

    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            echo "### File: $file"
            EXT="${file##*.}"
            echo '```'$EXT
            cat "$file"
            echo '```'
            echo ""
        fi
    done

} > "$OUTPUT_FILE"

# Copy final combined payload to clipboard
if [[ "$OSTYPE" == "darwin"* ]]; then
    pbcopy < "$OUTPUT_FILE"
else
    xclip -selection clipboard < "$OUTPUT_FILE"
fi

echo "✅ Phoenix Boot Payload ready! Paste this into Gemini after the Phase A prompt."
