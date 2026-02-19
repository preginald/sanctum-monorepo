#!/bin/bash
# sanctum_common.sh v1.0 — Shared functions for Sanctum CLI tools
# Source this file: source "$(dirname "$0")/../lib/sanctum_common.sh"

# Colors
GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; GRAY='\033[0;90m'; NC='\033[0m'

# Defaults
TOKEN_DIR="$HOME/.sanctum/tokens"
_SANCTUM_ENV="${_SANCTUM_ENV:-dev}"
_SANCTUM_AUTH_TOKEN=""

# ─────────────────────────────────────────────
# resolve_env — Sets API_BASE and PROFILE from env name
# Usage: resolve_env "prod"
# ─────────────────────────────────────────────
resolve_env() {
    _SANCTUM_ENV="${1:-dev}"
    case $_SANCTUM_ENV in
        dev)
            API_BASE="http://localhost:8000"
            PROFILE="${SANCTUM_PROFILE:-default}"
            ;;
        prod)
            API_BASE="https://core.digitalsanctum.com.au/api"
            PROFILE="${SANCTUM_PROFILE:-prod}"
            ;;
        *)
            echo -e "${RED}✗ Invalid env: $_SANCTUM_ENV (use dev or prod)${NC}"
            exit 1
            ;;
    esac
    TOKEN_FILE="${TOKEN_DIR}/${PROFILE}.txt"
    mkdir -p "$TOKEN_DIR"
}

# ─────────────────────────────────────────────
# ensure_auth — Ensures we have a valid auth token
# Priority: $SANCTUM_API_TOKEN > JWT token file > prompt
# Sets: _SANCTUM_AUTH_TOKEN
# ─────────────────────────────────────────────
ensure_auth() {
    # Priority 1: API Token (Personal Access Token)
    if [ -n "$SANCTUM_API_TOKEN" ]; then
        # Validate it works
        local health
        health=$(curl -s -H "Authorization: Bearer $SANCTUM_API_TOKEN" "${API_BASE}/")
        if echo "$health" | jq -e '.status == "operational"' > /dev/null 2>&1; then
            _SANCTUM_AUTH_TOKEN="$SANCTUM_API_TOKEN"
            echo -e "${GREEN}✓ Authenticated via API token (${SANCTUM_API_TOKEN:0:12}...)${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ API token invalid or expired${NC}"
        fi
    fi

    # Priority 2: Existing JWT token file
    if [ -f "$TOKEN_FILE" ]; then
        local existing_token
        existing_token=$(cat "$TOKEN_FILE")
        local health
        health=$(curl -s -H "Authorization: Bearer $existing_token" "${API_BASE}/" 2>/dev/null)
        if echo "$health" | jq -e '.status == "operational"' > /dev/null 2>&1; then
            _SANCTUM_AUTH_TOKEN="$existing_token"
            echo -e "${GREEN}✓ Authenticated via saved token (${PROFILE})${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ Saved token expired for profile '${PROFILE}'${NC}"
        fi
    fi

    # Priority 3: Interactive authentication
    echo -e "${YELLOW}→ No valid token found. Authenticating...${NC}"
    echo ""
    read -p "Email: " _AUTH_EMAIL
    read -sp "Password: " _AUTH_PASSWORD
    echo ""

    local response
    response=$(curl -s -X POST "${API_BASE}/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${_AUTH_EMAIL}&password=${_AUTH_PASSWORD}")

    local detail
    detail=$(echo "$response" | jq -r '.detail // empty')

    # Handle 2FA
    if [ "$detail" = "2FA_REQUIRED" ]; then
        echo -e "${YELLOW}→ 2FA required${NC}"
        if [ -n "$SANCTUM_TOTP_SECRET" ] && command -v oathtool &> /dev/null; then
            local totp_code
            totp_code=$(oathtool --totp -b "$SANCTUM_TOTP_SECRET")
            echo -e "${GREEN}→ Auto-generated TOTP: ${totp_code}${NC}"
        else
            read -p "Enter TOTP code: " totp_code
        fi

        response=$(curl -s -X POST "${API_BASE}/token" \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -d "username=${_AUTH_EMAIL}&password=${_AUTH_PASSWORD}&otp=${totp_code}")
    fi

    local token
    token=$(echo "$response" | jq -r '.access_token // empty')

    if [ -z "$token" ] || [ "$token" = "null" ]; then
        echo -e "${RED}✗ Authentication failed${NC}"
        echo "$response" | jq 2>/dev/null || echo "$response"
        exit 1
    fi

    # Save token
    echo "$token" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"
    _SANCTUM_AUTH_TOKEN="$token"
    echo -e "${GREEN}✓ Authenticated and token saved (${PROFILE})${NC}"
}

# ─────────────────────────────────────────────
# API helpers — authenticated HTTP methods
# Usage: api_get "/tickets"
#        api_post "/tickets" '{"subject":"Test"}'
# ─────────────────────────────────────────────
api_get() {
    curl -s -H "Authorization: Bearer $_SANCTUM_AUTH_TOKEN" -H "Content-Type: application/json" "${API_BASE}$1"
}

api_post() {
    curl -s -X POST -H "Authorization: Bearer $_SANCTUM_AUTH_TOKEN" -H "Content-Type: application/json" -d "$2" "${API_BASE}$1"
}

api_put() {
    curl -s -X PUT -H "Authorization: Bearer $_SANCTUM_AUTH_TOKEN" -H "Content-Type: application/json" -d "$2" "${API_BASE}$1"
}

api_delete() {
    curl -s -X DELETE -H "Authorization: Bearer $_SANCTUM_AUTH_TOKEN" -H "Content-Type: application/json" "${API_BASE}$1"
}

# ─────────────────────────────────────────────
# resolve_project — Fuzzy match project name → ID + account_id
# Usage: resolve_project "Sanctum Core"
# Sets: PROJECT_ID, ACCOUNT_ID, PROJECT_DISPLAY
# ─────────────────────────────────────────────
resolve_project() {
    local name="$1"
    echo -e "${YELLOW}→ Resolving project: ${name}...${NC}"

    local projects
    projects=$(api_get "/projects")

    local project
    project=$(echo "$projects" | jq -r --arg name "$name" \
        '[.[] | select(.name | ascii_downcase | contains($name | ascii_downcase))] | first // empty')

    if [ -z "$project" ] || [ "$project" = "null" ]; then
        echo -e "${RED}✗ Project not found: '${name}'${NC}"
        echo -e "${GRAY}Available projects:${NC}"
        echo "$projects" | jq -r '.[].name' | head -15
        return 1
    fi

    PROJECT_ID=$(echo "$project" | jq -r '.id')
    ACCOUNT_ID=$(echo "$project" | jq -r '.account_id')
    PROJECT_DISPLAY=$(echo "$project" | jq -r '.name')
    echo -e "${GREEN}  ✓ ${PROJECT_DISPLAY}${NC} ${GRAY}(${PROJECT_ID})${NC}"
}

# ─────────────────────────────────────────────
# resolve_milestone — Fuzzy match milestone within a project
# Usage: resolve_milestone "QoL" "$PROJECT_ID"
# Sets: MILESTONE_ID, MILESTONE_DISPLAY
# ─────────────────────────────────────────────
resolve_milestone() {
    local name="$1"
    local project_id="$2"
    echo -e "${YELLOW}→ Resolving milestone: ${name}...${NC}"

    local detail
    detail=$(api_get "/projects/${project_id}")

    local milestone
    milestone=$(echo "$detail" | jq -r --arg name "$name" \
        '[.milestones[] | select(.name | ascii_downcase | contains($name | ascii_downcase))] | first // empty')

    if [ -z "$milestone" ] || [ "$milestone" = "null" ]; then
        echo -e "${RED}✗ Milestone not found: '${name}'${NC}"
        echo -e "${GRAY}Available milestones:${NC}"
        echo "$detail" | jq -r '.milestones[].name'
        return 1
    fi

    MILESTONE_ID=$(echo "$milestone" | jq -r '.id')
    MILESTONE_DISPLAY=$(echo "$milestone" | jq -r '.name')
    echo -e "${GREEN}  ✓ ${MILESTONE_DISPLAY}${NC} ${GRAY}(${MILESTONE_ID})${NC}"
}

# ─────────────────────────────────────────────
# resolve_account — Fuzzy match account name → ID
# Usage: resolve_account "Digital Sanctum"
# Sets: ACCOUNT_ID, ACCOUNT_DISPLAY
# ─────────────────────────────────────────────
resolve_account() {
    local name="$1"
    echo -e "${YELLOW}→ Resolving account: ${name}...${NC}"

    local accounts
    accounts=$(api_get "/accounts")

    local account
    account=$(echo "$accounts" | jq -r --arg name "$name" \
        '[.[] | select(.name | ascii_downcase | contains($name | ascii_downcase))] | first // empty')

    if [ -z "$account" ] || [ "$account" = "null" ]; then
        echo -e "${RED}✗ Account not found: '${name}'${NC}"
        echo -e "${GRAY}Available accounts:${NC}"
        echo "$accounts" | jq -r '.[].name' | head -10
        return 1
    fi

    ACCOUNT_ID=$(echo "$account" | jq -r '.id')
    ACCOUNT_DISPLAY=$(echo "$account" | jq -r '.name')
    echo -e "${GREEN}  ✓ ${ACCOUNT_DISPLAY}${NC} ${GRAY}(${ACCOUNT_ID})${NC}"
}

# ─────────────────────────────────────────────
# print_env_banner — Show environment context
# ─────────────────────────────────────────────
print_env_banner() {
    local label="$1"
    echo -e "${BLUE}=== ${label} ===${NC}"
    if [ "$_SANCTUM_ENV" = "prod" ]; then
        echo -e "${RED}  ██ PRODUCTION ██  ${API_BASE}${NC}"
    else
        echo -e "${GRAY}  env: dev — ${API_BASE}${NC}"
    fi
    echo ""
}

# ─────────────────────────────────────────────
# confirm_prod — Safety prompt before prod writes
# Usage: confirm_prod "About to create ticket"
# ─────────────────────────────────────────────
confirm_prod() {
    if [ "$_SANCTUM_ENV" = "prod" ]; then
        echo ""
        echo -e "${RED}⚠ $1 on PRODUCTION${NC}"
        read -p "Continue? [y/N] " -n 1 -r
        echo ""
        [[ ! $REPLY =~ ^[Yy]$ ]] && echo "Aborted." && exit 0
    fi
}
