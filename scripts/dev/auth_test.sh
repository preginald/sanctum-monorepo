#!/bin/bash
# auth_test.sh v2.0 - Enhanced authentication with profile management
# Usage: ./auth_test.sh [email] [password]
#        SANCTUM_PROFILE=admin ./auth_test.sh admin@example.com password

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

# Configuration
API_BASE="${API_BASE:-http://localhost:8000}"
TOKEN_DIR="$HOME/.sanctum/tokens"
PROFILE="${SANCTUM_PROFILE:-default}"
TOKEN_FILE="${TOKEN_DIR}/${PROFILE}.txt"

# Create token directory
mkdir -p "$TOKEN_DIR"

# Parse arguments
if [ -n "$1" ] && [ -n "$2" ]; then
    EMAIL="$1"
    PASSWORD="$2"
else
    echo -e "${BLUE}=== Sanctum API Authentication ===${NC}"
    echo -e "${GRAY}Profile: ${PROFILE}${NC}"
    echo -e "${GRAY}API: ${API_BASE}${NC}"
    echo ""
    read -p "Email: " EMAIL
    read -sp "Password: " PASSWORD
    echo ""
fi

# Check for existing valid token
if [ -f "$TOKEN_FILE" ]; then
    echo -e "${YELLOW}→ Found existing token for profile '${PROFILE}'${NC}"
    EXISTING_TOKEN=$(cat "$TOKEN_FILE")
    
    # Test if token is still valid
    HEALTH=$(curl -s -H "Authorization: Bearer $EXISTING_TOKEN" "${API_BASE}/" 2>/dev/null || echo "{}")
    
    if echo "$HEALTH" | jq -e '.status == "operational"' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Existing token is still valid${NC}"
        echo ""
        read -p "Use existing token? [Y/n] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            echo -e "${BLUE}Token location: ${TOKEN_FILE}${NC}"
            echo ""
            echo -e "${GREEN}Ready to use!${NC}"
            echo ""
            echo "Quick commands:"
            echo -e "${BLUE}export TOKEN=\$(cat ${TOKEN_FILE})${NC}"
            echo -e "${BLUE}./scripts/dev/api_test.sh GET /sentinel/templates${NC}"
            exit 0
        fi
    else
        echo -e "${YELLOW}→ Token expired or invalid, re-authenticating...${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}[1/4]${NC} Authenticating as ${EMAIL}..."

# Initial login attempt
RESPONSE=$(curl -s -X POST "${API_BASE}/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${EMAIL}&password=${PASSWORD}")

DETAIL=$(echo "$RESPONSE" | jq -r '.detail // empty')

# Handle 2FA if required
if [ "$DETAIL" = "2FA_REQUIRED" ]; then
    echo -e "${YELLOW}→ 2FA enabled on account${NC}"
    
    # Auto-generate TOTP if secret is in environment
    if [ -n "$SANCTUM_TOTP_SECRET" ] && command -v oathtool &> /dev/null; then
        TOTP_CODE=$(oathtool --totp -b "$SANCTUM_TOTP_SECRET")
        echo -e "${GREEN}→ Auto-generated TOTP: ${TOTP_CODE}${NC}"
    else
        if [ -z "$SANCTUM_TOTP_SECRET" ]; then
            echo -e "${GRAY}💡 Tip: Set SANCTUM_TOTP_SECRET for auto-TOTP generation${NC}"
        fi
        read -p "Enter TOTP code: " TOTP_CODE
    fi
    
    echo -e "${YELLOW}[2/4]${NC} Verifying TOTP code..."
    
    RESPONSE=$(curl -s -X POST "${API_BASE}/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${EMAIL}&password=${PASSWORD}&otp=${TOTP_CODE}")
fi

# Extract token
TOKEN=$(echo "$RESPONSE" | jq -r '.access_token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo -e "${RED}✗ Authentication failed${NC}"
    echo ""
    echo "$RESPONSE" | jq
    exit 1
fi

# Save token
echo "$TOKEN" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

# Save profile metadata
cat > "${TOKEN_DIR}/${PROFILE}.json" << EOF
{
  "email": "$EMAIL",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "api_base": "$API_BASE",
  "profile": "$PROFILE"
}
EOF

echo -e "${GREEN}✓ Token saved to ${TOKEN_FILE}${NC}"

# Test Sentinel Templates endpoint
echo -e "${YELLOW}[3/4]${NC} Testing Sentinel Templates endpoint..."

TEMPLATES=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "${API_BASE}/sentinel/templates")

TEMPLATE_COUNT=$(echo "$TEMPLATES" | jq 'length // 0')

if [ "$TEMPLATE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Found ${TEMPLATE_COUNT} audit templates${NC}"
    echo "$TEMPLATES" | jq -r '.[] | "  - \(.name) (\(.framework))"' | head -5
    if [ "$TEMPLATE_COUNT" -gt 5 ]; then
        echo -e "${GRAY}  ... and $((TEMPLATE_COUNT - 5)) more${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No templates found (or endpoint error)${NC}"
fi

# Verify token validity
echo -e "${YELLOW}[4/4]${NC} Verifying token validity..."

HEALTH=$(curl -s -H "Authorization: Bearer $TOKEN" "${API_BASE}/")

if echo "$HEALTH" | jq -e '.status == "operational"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Token is valid and operational${NC}"
else
    echo -e "${YELLOW}⚠ Health check returned unexpected response${NC}"
fi

# Success summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Authentication successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Profile: ${BLUE}${PROFILE}${NC}"
echo -e "Email: ${BLUE}${EMAIL}${NC}"
echo -e "Token: ${BLUE}${TOKEN_FILE}${NC}"
echo -e "API: ${BLUE}${API_BASE}${NC}"
echo ""
echo "Quick commands:"
echo -e "${BLUE}export TOKEN=\$(cat ${TOKEN_FILE})${NC}"
echo -e "${BLUE}./scripts/dev/api_test.sh GET /sentinel/templates${NC}"
echo -e "${BLUE}./scripts/dev/api_test.sh POST /tickets '{\"subject\":\"Test\"}'${NC}"
echo ""
echo "Switch profiles:"
echo -e "${BLUE}SANCTUM_PROFILE=admin ./scripts/dev/auth_test.sh${NC}"
echo -e "${BLUE}SANCTUM_PROFILE=admin ./scripts/dev/api_test.sh GET /admin/users${NC}"
echo ""
