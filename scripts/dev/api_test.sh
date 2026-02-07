#!/bin/bash
# api_test.sh - Generic API testing utility with saved token
# Usage: ./api_test.sh GET /sentinel/templates
#        ./api_test.sh POST /tickets '{"subject":"Test"}'

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Config
API_BASE="${API_BASE:-http://localhost:8000/api}"
TOKEN_FILE="/tmp/sanctum_token.txt"

# Check if token exists
if [ ! -f "$TOKEN_FILE" ]; then
    echo -e "${RED}✗ No token found. Run ./auth_test.sh first.${NC}"
    exit 1
fi

TOKEN=$(cat "$TOKEN_FILE")

# Parse arguments
METHOD="${1:-GET}"
ENDPOINT="${2:-/system/health}"
BODY="${3:-}"

# Build curl command
CURL_CMD="curl -s -X ${METHOD}"
CURL_CMD="${CURL_CMD} -H 'Authorization: Bearer ${TOKEN}'"
CURL_CMD="${CURL_CMD} -H 'Content-Type: application/json'"

if [ -n "$BODY" ]; then
    CURL_CMD="${CURL_CMD} -d '${BODY}'"
fi

CURL_CMD="${CURL_CMD} '${API_BASE}${ENDPOINT}'"

# Execute
echo -e "${BLUE}→ ${METHOD} ${ENDPOINT}${NC}"
if [ -n "$BODY" ]; then
    echo -e "${YELLOW}Body: ${BODY}${NC}"
fi
echo ""

eval "$CURL_CMD" | jq

