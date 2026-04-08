#!/usr/bin/env bash
# setup-passwordless-access.sh
# Automates SSH key generation, key distribution, and passwordless sudo setup.
# Designed for use by Hermes (sanctum-agent) on the VPS.
#
# Usage:
#   setup-passwordless-access.sh <username> <server_ip>
#   setup-passwordless-access.sh <username> local
#
# Examples:
#   setup-passwordless-access.sh deploy 10.0.0.5      # Remote server
#   setup-passwordless-access.sh deploy local          # This machine

set -euo pipefail

KEY_TYPE="ed25519"
KEY_COMMENT="sanctum-managed"

usage() {
    echo "Usage: $0 <username> <server_ip|local>"
    echo ""
    echo "Automates passwordless SSH + sudo setup:"
    echo "  1. Generates an ED25519 SSH key pair (if not exists)"
    echo "  2. Copies the public key to the target server"
    echo "  3. Configures passwordless sudo on the target"
    echo ""
    echo "Pass 'local' as server_ip to configure this machine."
    exit 1
}

log() { echo "[$(date '+%H:%M:%S')] $*"; }
err() { echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2; }

# --- Argument validation ---
[[ $# -ne 2 ]] && usage

USERNAME="$1"
TARGET="$2"

if [[ ! "$USERNAME" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]]; then
    err "Invalid username '$USERNAME'"
    exit 1
fi

# --- Step 1: SSH Key Generation ---
KEY_PATH="$HOME/.ssh/id_${KEY_TYPE}_${USERNAME}"

if [[ -f "$KEY_PATH" ]]; then
    log "SSH key already exists: $KEY_PATH"
else
    log "Generating $KEY_TYPE key pair for '$USERNAME'..."
    ssh-keygen -t "$KEY_TYPE" -f "$KEY_PATH" -N "" -C "${KEY_COMMENT}-${USERNAME}"
    log "Key pair created: $KEY_PATH"
fi

# --- Step 2: Key Distribution ---
if [[ "$TARGET" == "local" ]]; then
    log "Target is local — skipping ssh-copy-id"
    log "Ensuring user '$USERNAME' exists locally..."

    if ! id "$USERNAME" &>/dev/null; then
        err "User '$USERNAME' does not exist on this machine"
        err "Create the user first: sudo adduser $USERNAME"
        exit 1
    fi

    # Append key to local user's authorized_keys
    LOCAL_AUTH_KEYS="/home/${USERNAME}/.ssh/authorized_keys"
    PUB_KEY=$(cat "${KEY_PATH}.pub")

    if [[ -f "$LOCAL_AUTH_KEYS" ]] && grep -qF "$PUB_KEY" "$LOCAL_AUTH_KEYS"; then
        log "Public key already in $LOCAL_AUTH_KEYS"
    else
        sudo mkdir -p "/home/${USERNAME}/.ssh"
        echo "$PUB_KEY" | sudo tee -a "$LOCAL_AUTH_KEYS" > /dev/null
        sudo chmod 700 "/home/${USERNAME}/.ssh"
        sudo chmod 600 "$LOCAL_AUTH_KEYS"
        sudo chown -R "${USERNAME}:${USERNAME}" "/home/${USERNAME}/.ssh"
        log "Public key added to $LOCAL_AUTH_KEYS"
    fi
else
    log "Copying public key to ${USERNAME}@${TARGET}..."
    ssh-copy-id -i "${KEY_PATH}.pub" "${USERNAME}@${TARGET}"
    log "Key distributed to ${TARGET}"
fi

# --- Step 3: Passwordless Sudo ---
if [[ "$TARGET" == "local" ]]; then
    log "Configuring passwordless sudo for '$USERNAME' (local)..."
    sudo /usr/local/bin/sanctum-sudoers-manage add "$USERNAME"
else
    log "Configuring passwordless sudo for '$USERNAME' on ${TARGET}..."
    # shellcheck disable=SC2029
    ssh "${USERNAME}@${TARGET}" \
        "sudo /usr/local/bin/sanctum-sudoers-manage add ${USERNAME} 2>&1 || echo 'WARN: sanctum-sudoers-manage not found on remote — manual sudoers setup required'"
fi

# --- Summary ---
echo ""
echo "========================================="
echo "  Passwordless Access Setup Complete"
echo "========================================="
echo "  User:       $USERNAME"
echo "  Target:     $TARGET"
echo "  Key:        $KEY_PATH"
echo "  Sudo:       NOPASSWD: ALL"
echo ""
echo "  Test with:  ssh -i $KEY_PATH ${USERNAME}@${TARGET} 'sudo whoami'"
echo "========================================="
