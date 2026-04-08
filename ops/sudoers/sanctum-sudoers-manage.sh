#!/usr/bin/env bash
# /usr/local/bin/sanctum-sudoers-manage
# Validated wrapper for managing passwordless sudo via /etc/sudoers.d/ drop-in files.
# Only callable via scoped sudo by sanctum-agent.
#
# Usage:
#   sanctum-sudoers-manage add <username>
#   sanctum-sudoers-manage remove <username>
#   sanctum-sudoers-manage list

set -euo pipefail

SUDOERS_DIR="/etc/sudoers.d"
PROTECTED_USERS="root sanctum-agent"

usage() {
    echo "Usage: $0 {add|remove|list} [username]"
    exit 1
}

validate_username() {
    local user="$1"

    # Must be a valid Linux username (alphanumeric, hyphen, underscore, 1-32 chars)
    if [[ ! "$user" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]]; then
        echo "ERROR: Invalid username '$user'" >&2
        exit 1
    fi

    # Refuse to modify protected users
    for protected in $PROTECTED_USERS; do
        if [[ "$user" == "$protected" ]]; then
            echo "ERROR: Cannot modify sudoers for protected user '$user'" >&2
            exit 1
        fi
    done

    # User must exist on the system
    if ! id "$user" &>/dev/null; then
        echo "ERROR: User '$user' does not exist on this system" >&2
        exit 1
    fi
}

do_add() {
    local user="$1"
    local dropfile="${SUDOERS_DIR}/${user}"

    validate_username "$user"

    if [[ -f "$dropfile" ]]; then
        echo "Sudoers entry already exists for '$user':"
        cat "$dropfile"
        exit 0
    fi

    # Write to a temp file first, validate, then move into place
    local tmpfile
    tmpfile=$(mktemp /tmp/sudoers-XXXXXX)
    echo "${user} ALL=(ALL) NOPASSWD: ALL" > "$tmpfile"

    # Validate syntax before committing
    if ! visudo -c -f "$tmpfile" &>/dev/null; then
        echo "ERROR: Sudoers syntax validation failed" >&2
        rm -f "$tmpfile"
        exit 1
    fi

    # Move into place with correct permissions
    mv "$tmpfile" "$dropfile"
    chmod 0440 "$dropfile"
    chown root:root "$dropfile"

    # Final validation of the entire sudoers config
    if ! visudo -c &>/dev/null; then
        echo "ERROR: Full sudoers validation failed — rolling back" >&2
        rm -f "$dropfile"
        exit 1
    fi

    echo "OK: Passwordless sudo enabled for '$user'"
}

do_remove() {
    local user="$1"
    local dropfile="${SUDOERS_DIR}/${user}"

    validate_username "$user"

    if [[ ! -f "$dropfile" ]]; then
        echo "No sudoers entry found for '$user'"
        exit 0
    fi

    rm -f "$dropfile"

    # Validate removal didn't break anything
    if ! visudo -c &>/dev/null; then
        echo "ERROR: Sudoers validation failed after removal" >&2
        exit 1
    fi

    echo "OK: Sudoers entry removed for '$user'"
}

do_list() {
    echo "Managed sudoers drop-in files:"
    for f in "${SUDOERS_DIR}"/*; do
        [[ -f "$f" ]] || continue
        local name
        name=$(basename "$f")
        # Skip non-user files (README, etc.)
        [[ "$name" == "README" ]] && continue
        printf "  %-20s %s\n" "$name" "$(cat "$f")"
    done
}

# --- Main ---
[[ $# -lt 1 ]] && usage

case "$1" in
    add)
        [[ $# -ne 2 ]] && usage
        do_add "$2"
        ;;
    remove)
        [[ $# -ne 2 ]] && usage
        do_remove "$2"
        ;;
    list)
        do_list
        ;;
    *)
        usage
        ;;
esac
