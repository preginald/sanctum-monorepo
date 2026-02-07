#!/bin/bash
# auth_test.sh - Get authentication token and test Sentinel API
# Usage: ./auth_test.sh [email] [password]

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Config
API_BASE="${API_BASE:-http://localhost:8000}"
TOKEN_FILE="/tmp/sanctum_token.txt"

# Use arguments or prompt
if [ -n "$1" ] && [ -n "$2" ]; then
    EMAIL="$1"
    PASSWORD="$2"
else
    echo -e "${BLUE}=== Sanctum API Authentication ===${NC}"
    read -p "Email: " EMAIL
    read -sp "Password: " PASSWORD
    echo ""
fi

echo -e "${YELLOW}[1/4]${NC} Authenticating as ${EMAIL}..."

# Initial login attempt (form-data format for OAuth2)
RESPONSE=$(curl -s -X POST "${API_BASE}/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${EMAIL}&password=${PASSWORD}")

# Check if 2FA is required
DETAIL=$(echo "$RESPONSE" | jq -r '.detail // empty')

if [ "$DETAIL" = "2FA_REQUIRED" ]; then
    echo -e "${YELLOW}→ 2FA enabled on account${NC}"
    read -p "Enter TOTP code: " TOTP_CODE
    
    echo -e "${YELLOW}[2/4]${NC} Verifying TOTP code..."
    
    RESPONSE=$(curl -s -X POST "${API_BASE}/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${EMAIL}&password=${PASSWORD}&otp=${TOTP_CODE}")
fi

TOKEN=$(echo "$RESPONSE" | jq -r '.access_token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo -e "${RED}✗ Authentication failed${NC}"
    echo "$RESPONSE" | jq
    exit 1
fi

# Save token to file
echo "$TOKEN" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

echo -e "${GREEN}✓ Token obtained and saved to ${TOKEN_FILE}${NC}"

# Test Sentinel Templates endpoint
echo -e "${YELLOW}[3/4]${NC} Testing Sentinel Templates endpoint..."

TEMPLATES=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "${API_BASE}/sentinel/templates")

TEMPLATE_COUNT=$(echo "$TEMPLATES" | jq 'length // 0')

if [ "$TEMPLATE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Found ${TEMPLATE_COUNT} audit templates${NC}"
    echo "$TEMPLATES" | jq -r '.[] | "  - \(.name) (\(.framework))"'
else
    echo -e "${YELLOW}⚠ No templates found (or endpoint error)${NC}"
    echo "$TEMPLATES" | jq
fi

# Test user profile endpoint (need to find the correct endpoint)
echo -e "${YELLOW}[4/4]${NC} Verifying token validity..."

# Test with a simple endpoint to confirm token works
HEALTH=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "${API_BASE}/")

if echo "$HEALTH" | jq -e '.status == "operational"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Token is valid${NC}"
else
    echo -e "${YELLOW}⚠ Could not verify token (endpoint may require auth)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Authentication successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Token saved to: ${BLUE}${TOKEN_FILE}${NC}"
echo -e "Use with: ${BLUE}export TOKEN=\$(cat ${TOKEN_FILE})${NC}"
echo ""
echo "Example API calls:"
echo -e "${BLUE}curl -H \"Authorization: Bearer \$(cat ${TOKEN_FILE})\" ${API_BASE}/sentinel/templates | jq${NC}"
echo -e "${BLUE}./scripts/dev/api_test.sh GET /sentinel/templates${NC}"

