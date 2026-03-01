#!/bin/bash
# create_milestone.sh v1.0 — CLI Milestone Creator for Sanctum Core
# Uses shared library for auth, env resolution, and API helpers.
#
# Usage:
#   ./scripts/dev/create_milestone.sh --project-id <uuid> --name "Phase 64: The Blueprint"
#   ./scripts/dev/create_milestone.sh -e prod --project-id <uuid> --name "Launch" --due-date 2026-03-31 --amount 2500 --sequence 1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/sanctum_common.sh"

PROJECT_ID=""; NAME=""; DUE_DATE=""; AMOUNT=""; SEQUENCE=""; ENV="dev"

while [[ $# -gt 0 ]]; do
    case $1 in
        --project-id)   PROJECT_ID="$2"; shift 2 ;;
        -n|--name)      NAME="$2"; shift 2 ;;
        --due-date)     DUE_DATE="$2"; shift 2 ;;
        --amount)       AMOUNT="$2"; shift 2 ;;
        --sequence)     SEQUENCE="$2"; shift 2 ;;
        -e|--env)       ENV="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: create_milestone.sh [options]"
            echo ""
            echo "Required:"
            echo "  --project-id    Project UUID to attach milestone to"
            echo "  -n, --name      Milestone name"
            echo ""
            echo "Optional:"
            echo "  -e, --env       dev | prod (default: dev)"
            echo "  --due-date      Due date (YYYY-MM-DD)"
            echo "  --amount        Billable amount (e.g. 2500)"
            echo "  --sequence      Display order (integer, default: 1)"
            echo ""
            echo "Auth: Set SANCTUM_API_TOKEN for token auth, or will use saved JWT / prompt."
            echo ""
            echo "Examples:"
            echo "  ./scripts/dev/create_milestone.sh --project-id <uuid> -n 'The Blueprint'"
            echo "  ./scripts/dev/create_milestone.sh -e prod --project-id <uuid> -n 'Launch' --due-date 2026-03-31 --amount 1500"
            echo ""
            echo "Pipe into sanctum.sh:"
            echo "  ./scripts/dev/sanctum.sh ticket create -e prod -p 'Sanctum Core' -m 'The Blueprint' --type feature -s 'My ticket'"
            exit 0 ;;
        *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
    esac
done

# Validation
[ -z "$PROJECT_ID" ] && echo -e "${RED}✗ --project-id is required${NC}" && exit 1
[ -z "$NAME" ]       && echo -e "${RED}✗ --name is required${NC}" && exit 1

# Init
resolve_env "$ENV"
print_env_banner "Sanctum Milestone Creator"
ensure_auth

# Safety check
confirm_prod "About to create milestone: ${NAME}"

# Build payload — only include optional fields if provided
echo -e "${YELLOW}→ Creating milestone...${NC}"

PAYLOAD=$(jq -n \
    --arg name "$NAME" \
    --arg due_date "$DUE_DATE" \
    --arg amount "$AMOUNT" \
    --arg sequence "$SEQUENCE" \
    '{name: $name, status: "pending"}
    | if $due_date != "" then .due_date = $due_date else . end
    | if $amount  != "" then .billable_amount = ($amount | tonumber) else . end
    | if $sequence != "" then .sequence = ($sequence | tonumber) else .sequence = 1 end')

RESULT=$(api_post "/projects/${PROJECT_ID}/milestones" "$PAYLOAD")
MILESTONE_ID=$(echo "$RESULT" | jq -r '.id // empty')

if [ -z "$MILESTONE_ID" ]; then
    echo -e "${RED}✗ Failed to create milestone${NC}"
    echo "$RESULT" | jq
    exit 1
fi

MILESTONE_NAME=$(echo "$RESULT" | jq -r '.name')

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Milestone Created${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Name:       ${BLUE}${MILESTONE_NAME}${NC}"
echo -e "  ID:         ${GRAY}${MILESTONE_ID}${NC}"
[ -n "$DUE_DATE" ] && echo -e "  Due Date:   ${BLUE}${DUE_DATE}${NC}"
[ -n "$AMOUNT"   ] && echo -e "  Amount:     ${BLUE}\$${AMOUNT}${NC}"
echo ""
echo -e "${YELLOW}→ Next: create a ticket linked to this milestone:${NC}"
echo -e "${GRAY}  ./scripts/dev/sanctum.sh ticket create -e ${ENV} -p 'Sanctum Core' -m '${MILESTONE_NAME}' --type feature -s 'Your subject'${NC}"
echo ""
