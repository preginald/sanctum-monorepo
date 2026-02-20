#!/bin/bash
# create_ticket.sh v2.0 — CLI Ticket Creator for Sanctum Core
# Uses shared library for auth, env resolution, and entity lookup.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/sanctum_common.sh"

SUBJECT=""; DESCRIPTION=""; PRIORITY="normal"; TICKET_TYPE="task"
PROJECT_NAME=""; MILESTONE_NAME=""; ACCOUNT_NAME=""; ENV="dev"

while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--subject)     SUBJECT="$2"; shift 2 ;;
        -d|--description) DESCRIPTION="$2"; shift 2 ;;
        -p|--project)     PROJECT_NAME="$2"; shift 2 ;;
        -m|--milestone)   MILESTONE_NAME="$2"; shift 2 ;;
        --project-id)     PROJECT_ID="$2"; shift 2 ;;
        -a|--account)     ACCOUNT_NAME="$2"; shift 2 ;;
        -e|--env)         ENV="$2"; shift 2 ;;
        --priority)       PRIORITY="$2"; shift 2 ;;
        --type)           TICKET_TYPE="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: create_ticket.sh [options]"
            echo ""
            echo "Required:"
            echo "  -s, --subject       Ticket subject"
            echo "  -p, --project       Project name (resolves account + project ID)"
            echo "  OR -a, --account    Account name (if no project)"
            echo ""
            echo "Optional:"
            echo "  -e, --env           dev | prod (default: dev)"
            echo "  -m, --milestone     Milestone name within project"
            echo "  -d, --description   Ticket description"
            echo "  --priority          low | normal | high | critical (default: normal)"
            echo "  --type              support | bug | feature | task | refactor | hotfix (default: task)"
            echo ""
            echo "Auth: Set SANCTUM_API_TOKEN for token auth, or will use saved JWT / prompt."
            echo ""
            echo "Examples:"
            echo "  ./scripts/dev/create_ticket.sh -s 'Fix login' -p 'Sanctum Core' -m 'QoL Polish' --type bug"
            echo "  ./scripts/dev/create_ticket.sh -e prod -s 'New feature' -a 'Digital Sanctum HQ'"
            exit 0 ;;
        *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
    esac
done

[ -z "$SUBJECT" ] && echo -e "${RED}✗ --subject is required${NC}" && exit 1
[ -z "$PROJECT_NAME" ] && [ -z "$ACCOUNT_NAME" ] && [ -z "$PROJECT_ID" ] && echo -e "${RED}✗ Either --project, --project-id, or --account is required${NC}" && exit 1

# Init
resolve_env "$ENV"
print_env_banner "Sanctum Ticket Creator"
ensure_auth

# Resolve entities
ACCOUNT_ID=""; MILESTONE_ID=""
PROJECT_DISPLAY=""; MILESTONE_DISPLAY=""

if [ -n "$PROJECT_ID" ]; then
    echo -e "${YELLOW}→ Fetching project...${NC}"
    PROJECT_DETAIL=$(api_get "/projects/${PROJECT_ID}")
    ACCOUNT_ID=$(echo "$PROJECT_DETAIL" | jq -r '.account_id // empty')
    PROJECT_DISPLAY=$(echo "$PROJECT_DETAIL" | jq -r '.name // empty')
    if [ -z "$ACCOUNT_ID" ]; then
        echo -e "${RED}✗ Could not resolve project: ${PROJECT_ID}${NC}"
        exit 1
    fi
    echo -e "${GREEN}  ✓ ${PROJECT_DISPLAY}${NC}"
    if [ -n "$MILESTONE_NAME" ]; then
        resolve_milestone "$MILESTONE_NAME" "$PROJECT_ID" || exit 1
    fi
elif [ -n "$PROJECT_NAME" ]; then
    resolve_project "$PROJECT_NAME" || exit 1

    if [ -n "$MILESTONE_NAME" ]; then
        resolve_milestone "$MILESTONE_NAME" "$PROJECT_ID" || exit 1
    fi
else
    resolve_account "$ACCOUNT_NAME" || exit 1
fi

# Safety check
confirm_prod "About to create ticket: ${SUBJECT}"

# Create ticket
echo -e "${YELLOW}→ Creating ticket...${NC}"

PAYLOAD=$(jq -n \
    --arg account_id "$ACCOUNT_ID" \
    --arg subject "$SUBJECT" \
    --arg description "$DESCRIPTION" \
    --arg priority "$PRIORITY" \
    --arg ticket_type "$TICKET_TYPE" \
    --arg milestone_id "$MILESTONE_ID" \
    '{account_id: $account_id, subject: $subject, description: $description, priority: $priority, ticket_type: $ticket_type}
    | if $milestone_id != "" then .milestone_id = $milestone_id else . end')

RESULT=$(api_post "/tickets" "$PAYLOAD")
TICKET_ID=$(echo "$RESULT" | jq -r '.id // empty')

if [ -z "$TICKET_ID" ]; then
    echo -e "${RED}✗ Failed to create ticket${NC}"
    echo "$RESULT" | jq
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Ticket #${TICKET_ID} Created${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Subject:  ${BLUE}${SUBJECT}${NC}"
echo -e "  Priority: ${BLUE}${PRIORITY}${NC}"
echo -e "  Type:     ${BLUE}${TICKET_TYPE}${NC}"
echo -e "  Status:   ${BLUE}new${NC}"
[ -n "$PROJECT_DISPLAY" ] && echo -e "  Project:  ${BLUE}${PROJECT_DISPLAY}${NC}"
[ -n "$MILESTONE_DISPLAY" ] && echo -e "  Milestone:${BLUE} ${MILESTONE_DISPLAY}${NC}"
echo ""
if [ "$_SANCTUM_ENV" = "prod" ]; then
    echo -e "${GRAY}View: https://app.digitalsanctum.com.au/tickets/${TICKET_ID}${NC}"
else
    echo -e "${GRAY}View: http://localhost:5173/tickets/${TICKET_ID}${NC}"
fi
echo ""
