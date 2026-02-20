#!/bin/bash
# api_test.sh v2.0 - Enhanced API testing with logging and timing
# Usage: ./api_test.sh GET /sentinel/templates
#        ./api_test.sh POST /tickets '{"subject":"Test"}'
#        VERBOSE=true ./api_test.sh GET /endpoint

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
LOG_DIR="$HOME/.sanctum/logs"
VERBOSE="${VERBOSE:-false}"

# Create log directory
mkdir -p "$LOG_DIR"

# Check if token exists — prefer SANCTUM_API_TOKEN over saved JWT
if [ -n "$SANCTUM_API_TOKEN" ]; then
    TOKEN="$SANCTUM_API_TOKEN"
elif [ ! -f "$TOKEN_FILE" ]; then
    echo -e "${RED}✗ No token found for profile '${PROFILE}'.${NC}"
    echo -e "${YELLOW}Run: ./scripts/dev/auth_test.sh${NC}"
    if [ "$PROFILE" != "default" ]; then
        echo -e "${YELLOW}Or: SANCTUM_PROFILE=${PROFILE} ./scripts/dev/auth_test.sh${NC}"
    fi
    exit 1
else
    TOKEN=$(cat "$TOKEN_FILE")
fi

# Parse arguments
METHOD="${1:-GET}"
ENDPOINT="${2:-/}"
BODY="${3:-}"

# Validate method
if [[ ! "$METHOD" =~ ^(GET|POST|PUT|PATCH|DELETE)$ ]]; then
    echo -e "${RED}✗ Invalid HTTP method: ${METHOD}${NC}"
    echo "Valid methods: GET, POST, PUT, PATCH, DELETE"
    exit 1
fi

# Log file for this request
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/request_${TIMESTAMP}.log"

# Build curl command
CURL_CMD="curl -s -w '\n%{http_code}\n%{time_total}'"
CURL_CMD="${CURL_CMD} -X ${METHOD}"
CURL_CMD="${CURL_CMD} -H 'Authorization: Bearer ${TOKEN}'"
CURL_CMD="${CURL_CMD} -H 'Content-Type: application/json'"

if [ -n "$BODY" ]; then
    CURL_CMD="${CURL_CMD} -d '${BODY}'"
fi

CURL_CMD="${CURL_CMD} '${API_BASE}${ENDPOINT}'"

# Display request info
echo -e "${BLUE}→ ${METHOD} ${API_BASE}${ENDPOINT}${NC}"
if [ "$VERBOSE" == "true" ]; then
    echo -e "${GRAY}Profile: ${PROFILE}${NC}"
fi
if [ -n "$BODY" ]; then
    echo -e "${GRAY}Body:${NC}"
    echo "$BODY" | jq 2>/dev/null || echo "$BODY"
fi

# Log request
cat > "$LOG_FILE" << EOF
=== REQUEST ===
Method: $METHOD
Endpoint: $ENDPOINT
Base: $API_BASE
Profile: $PROFILE
Time: $(date)

Body:
$BODY

=== RESPONSE ===
EOF

# Execute and capture
START_TIME=$(date +%s%N)
RESULT=$(eval "$CURL_CMD" 2>&1)
END_TIME=$(date +%s%N)

# Parse response (last 2 lines are status code and time)
RESPONSE_BODY=$(echo "$RESULT" | head -n -2)
HTTP_CODE=$(echo "$RESULT" | tail -n 2 | head -n 1)
CURL_TIME=$(echo "$RESULT" | tail -n 1)

# Calculate timing
DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))

# Color code status
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    STATUS_COLOR="${GREEN}"
    STATUS_SYMBOL="✓"
elif [ "$HTTP_CODE" -ge 400 ] && [ "$HTTP_CODE" -lt 500 ]; then
    STATUS_COLOR="${RED}"
    STATUS_SYMBOL="✗"
elif [ "$HTTP_CODE" -ge 500 ]; then
    STATUS_COLOR="${RED}"
    STATUS_SYMBOL="✗✗"
else
    STATUS_COLOR="${YELLOW}"
    STATUS_SYMBOL="→"
fi

echo ""
echo -e "${STATUS_COLOR}${STATUS_SYMBOL} Status: ${HTTP_CODE}${NC} ${GRAY}(${DURATION_MS}ms)${NC}"
echo ""

# Pretty print JSON response
if echo "$RESPONSE_BODY" | jq empty 2>/dev/null; then
    # Valid JSON - pretty print
    echo "$RESPONSE_BODY" | jq
else
    # Not JSON or invalid - show raw
    echo "$RESPONSE_BODY"
fi

# Append to log
cat >> "$LOG_FILE" << EOF
$RESPONSE_BODY

=== METADATA ===
Status Code: $HTTP_CODE
Duration: ${DURATION_MS}ms
Curl Time: ${CURL_TIME}s
Profile: $PROFILE
EOF

# Verbose mode shows additional info
if [ "$VERBOSE" == "true" ]; then
    echo ""
    echo -e "${GRAY}────────────────────────────────${NC}"
    echo -e "${GRAY}Log: ${LOG_FILE}${NC}"
    echo -e "${GRAY}Curl Time: ${CURL_TIME}s${NC}"
    
    # Show token file location
    if [ -f "${TOKEN_DIR}/${PROFILE}.json" ]; then
        TOKEN_AGE=$(cat "${TOKEN_DIR}/${PROFILE}.json" | jq -r '.created_at')
        echo -e "${GRAY}Token Created: ${TOKEN_AGE}${NC}"
    fi
fi

# Return non-zero if HTTP error
if [ "$HTTP_CODE" -ge 400 ]; then
    exit 1
fi
