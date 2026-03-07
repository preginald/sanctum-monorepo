#!/bin/bash
# ==============================================================================
# srun.sh - Terminal capture to markdown utility
#
# Note on Installation:
# For best results, ensure this script is accessible in your PATH as 'srun'.
# You can do this by creating a symlink in a PATH directory (e.g., /usr/local/bin):
#   ln -sf ~/DigitalSanctum/scripts/dev/srun.sh /usr/local/bin/srun
# Canonical source: scripts/dev/srun.sh
# Full reference: DOC-010
# ==============================================================================
# --- Config & Flags ---
SHOW_HOST=false
LANG_TAG="text"
FILE_NAME=""
EXEC_MODE=false
EXEC_CMD=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        -s|--show-host)
            SHOW_HOST=true
            shift
            ;;
        -l|--lang)
            if [ -n "$2" ]; then
                LANG_TAG="$2"
                shift 2
            else
                echo -e "\033[0;31mError: --lang requires a language argument.\033[0m" >&2
                exit 1
            fi
            ;;
        -n|--name)
            if [ -n "$2" ]; then
                FILE_NAME="$2"
                shift 2
            else
                echo -e "\033[0;31mError: --name requires a label/filename argument.\033[0m" >&2
                exit 1
            fi
            ;;
        -x|--exec)
            EXEC_MODE=true
            shift
            EXEC_CMD=("$@")
            break
            ;;
        -h|--help|help)
            echo "Usage: <command> | srun [options]"
            echo "       srun --exec <command> [args...]"
            echo ""
            echo "Options:"
            echo "  -s, --show-host          Include hostname in the output"
            echo "  -l, --lang <lang>        Set the code block language (default: text)"
            echo "  -n, --name <name>        Add an optional label/filename above the code block"
            echo "  -x, --exec <cmd> [args]  Run command and capture both stdout and stderr"
            echo ""
            echo "Examples:"
            echo "  git status | srun"
            echo "  srun --exec git push"
            echo "  srun --exec npm run build"
            exit 0
            ;;
        *)
            echo -e "\033[0;31mUnknown option: $1\033[0m" >&2
            shift
            ;;
    esac
done

# --- Exec Mode: run command and capture stdout+stderr ---
if [ "$EXEC_MODE" = true ]; then
    if [ ${#EXEC_CMD[@]} -eq 0 ]; then
        echo -e "\033[0;31mError: --exec requires a command.\033[0m" >&2
        exit 1
    fi
    INPUT_DATA=$("${EXEC_CMD[@]}" 2>&1)
    EXIT_CODE=$?
else
    # --- Input Check (pipe mode) ---
    if [ -t 0 ]; then
        echo -e "\033[0;33mUsage: <command> | srun\033[0m"
        echo -e "\033[0;33m       srun --exec <command> [args...]\033[0m"
        exit 1
    fi
    INPUT_DATA=$(cat)
    EXIT_CODE=0
fi

# --- Context Gathering ---
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
PWD_CONTEXT=$(pwd)
HOST_NAME=$(hostname)

# Guard against empty input
if [ -z "$INPUT_DATA" ]; then
    echo "(no output)"
    exit $EXIT_CODE
fi

# --- Clipboard Tool Auto-detection ---
if command -v pbcopy &>/dev/null; then
    CLIP="pbcopy"
elif command -v wl-copy &>/dev/null; then
    CLIP="wl-copy"
elif command -v xclip &>/dev/null; then
    CLIP="xclip -selection clipboard"
else
    echo -e "\033[0;31mError: No supported clipboard tool found (pbcopy, wl-copy, xclip).\033[0m" >&2
    exit 1
fi

# --- Build the Markdown Block ---
{
    echo "---"
    echo "#### 🖥️ Terminal Capture"
    echo "**Time:** $TIMESTAMP"
    echo "**Path:** \`$PWD_CONTEXT\`"
    if [ "$SHOW_HOST" = true ]; then
        echo "**Host:** $HOST_NAME"
    fi
    if [ -n "$FILE_NAME" ]; then
        echo "**File:** \`$FILE_NAME\`"
    fi
    if [ "$EXEC_MODE" = true ]; then
        echo "**Command:** \`${EXEC_CMD[*]}\`"
    fi
    echo ""
    echo "\`\`\`$LANG_TAG"
    echo "$INPUT_DATA" | sed "s/$(printf '\033')\[[0-9;]*[mK]//g"
    echo "\`\`\`"
    echo "---"
} | $CLIP

# --- Output Logic ---
printf "%s\n" "$INPUT_DATA"
exit $EXIT_CODE
