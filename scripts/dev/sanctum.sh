#!/bin/bash
# sanctum.sh v1.0 — Unified CLI for Sanctum Core
# Usage: sanctum.sh <domain> <command> [options]
#
# Domains:  ticket, milestone, invoice, article
# Sources:  scripts/lib/sanctum_common.sh
#
# Examples:
#   sanctum.sh ticket create -s "Fix login" -p "Sanctum Core" -m "Phase 65" --type bug
#   sanctum.sh ticket update  256 -d "New description" --status open
#   sanctum.sh ticket resolve 250 -b "Fixed and deployed."
#   sanctum.sh ticket show 250
#   sanctum.sh ticket delete 250
#   sanctum.sh article create -t "My Article" --slug "my-article" --category "System Documentation" -f content.md
#   sanctum.sh article update <uuid> -f content.md
#   sanctum.sh article show <slug|identifier> [-c] [-e dev|prod]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/sanctum_common.sh"

main() {
# ─────────────────────────────────────────────
# USAGE
# ─────────────────────────────────────────────
usage() {
    echo ""
    echo -e "${BLUE}sanctum.sh v1.0 — Unified Sanctum CLI${NC}"
    echo ""
    echo "Usage: sanctum.sh <domain> <command> [options]"
    echo ""
    echo -e "${YELLOW}DOMAINS${NC}"
    echo "  ticket     Manage tickets (create, update, comment, resolve, list, show, delete)"
    echo "  milestone  Manage project milestones (create, update, list, show)"
    echo "  invoice    Manage invoices (create, update, delete, show)"
    echo "  article    Manage knowledge base articles (create, update, show)"
    echo ""
    echo -e "${YELLOW}GLOBAL OPTIONS${NC}"
    echo "  -e, --env       dev | prod (default: dev)"
    echo "  -h, --help      Show domain-specific help (e.g., sanctum.sh ticket --help)"
    echo ""
    echo -e "${YELLOW}AUTH${NC}"
    echo "  Set SANCTUM_API_TOKEN for zero-friction auth. Falls back to saved JWT or interactive prompt."
    echo ""
    exit 0
}

ticket_usage() {
    echo ""
    echo -e "${BLUE}sanctum.sh ticket — Manage Tickets${NC}"
    echo ""
    echo "Usage: sanctum.sh ticket <command> [options]"
    echo ""
    echo -e "${YELLOW}COMMANDS${NC}"
    echo "  create   Create a new ticket"
    echo "  update   Update an existing ticket"
    echo "  comment  Add a comment to a ticket"
    echo "  resolve  Resolve a ticket (adds comment + updates status)"
    echo "  list     List tickets, optionally filtered"
    echo "  show     Show ticket details"
    echo "  delete   Soft-delete (archive) a ticket"
    echo "  relate   Link one or more articles to a ticket"
    echo "  unrelate Unlink an article from a ticket"
    echo ""
    echo -e "${YELLOW}OPTIONS BY COMMAND${NC}"
    echo "  create:  -s|--subject <text>, -p|--project <name> OR -a|--account <name>,"
    echo "           [-m|--milestone <name>], [--type <type>], [--priority <priority>],"
    echo "           [-d|--description <text>], [--articles <id1,id2,...>], [-e|--env dev|prod]"
    echo "  update:  <id>, [-s|--subject], [-d|--description], [--status <status>],"
    echo "           [--priority <priority>], [--type <type>], [-m|--milestone <name>],"
    echo "           [--articles <id1,id2,...>], [-e|--env]"
    echo "  comment: <id>, -b|--body <text>, [--status <status>], [--visibility internal|public], [-e|--env]"
    echo "  resolve: <id>, -b|--body <text>, [--visibility internal|public], [-e|--env]"
    echo "  list:    [-p|--project <name>], [-m|--milestone <name>], [--status <status>], [-e|--env]"
    echo "  show:    <id>, [-e|--env]"
    echo "  delete:  <id>, [-e|--env]"
    echo "  relate:  <ticket_id> --articles <id1,id2,...>, [-e|--env]"
    echo "  unrelate:<ticket_id> --article <id>, [-e|--env]"
    echo ""
    echo -e "${YELLOW}ENUMERATIONS${NC}"
    echo "  Types:     support, bug, feature, refactor, task, access, maintenance, alert, hotfix, test"
    echo "  Priorities: low, normal, high, critical"
    echo "  Statuses:  new, open, pending, qa, resolved"
    echo ""
    echo -e "${YELLOW}EXAMPLES${NC}"
    echo "  sanctum.sh ticket create -s \"Fix login\" -p \"Sanctum Core\" -m \"Phase 65\" --type bug"
    echo "  sanctum.sh ticket create -s \"Setup guide\" -p \"Sanctum Core\" --articles \"DOC-001,WIKI-002\""
    echo "  sanctum.sh ticket relate 310 --articles \"DOC-001,WIKI-002\" -e prod"
    echo "  sanctum.sh ticket unrelate 310 --article DOC-001 -e prod"
    echo "  sanctum.sh ticket resolve 250 -b \"Fixed and deployed.\""
    echo ""
    exit 0
}

milestone_usage() {
    echo ""
    echo -e "${BLUE}sanctum.sh milestone — Manage Milestones${NC}"
    echo ""
    echo "Usage: sanctum.sh milestone <command> [options]"
    echo ""
    echo -e "${YELLOW}COMMANDS${NC}"
    echo "  create   Create a milestone under a project"
    echo "  update   Update milestone metadata"
    echo "  list     List all milestones for a project"
    echo "  show     Show milestone details"
    echo ""
    echo -e "${YELLOW}OPTIONS BY COMMAND${NC}"
    echo "  create:  -p|--project <name>, -n|--name <text>,"
    echo "           [--due-date <YYYY-MM-DD>],[--billable <amount>],"
    echo "           [--sequence <n>], [--description <text>], [-e|--env]"
    echo "  update:  <id>, [-n|--name],[--status <status>], [--due-date <YYYY-MM-DD>],"
    echo "[--billable <amount>], [--sequence <n>], [--description <text>], [-e|--env]"
    echo "  list:    -p|--project <name>, [-e|--env]"
    echo "  show:    <id>, [-e|--env]"
    echo ""
    echo -e "${YELLOW}EXAMPLES${NC}"
    echo "  sanctum.sh milestone create -p \"Sanctum Core\" -n \"Phase 67\" --sequence 49"
    echo "  sanctum.sh milestone list -p \"Naked Tech Website\""
    echo ""
    exit 0
}

invoice_usage() {
    echo ""
    echo -e "${BLUE}sanctum.sh invoice — Manage Invoices${NC}"
    echo ""
    echo "Usage: sanctum.sh invoice <command> [options]"
    echo ""
    echo -e "${YELLOW}COMMANDS${NC}"
    echo "  create   Create a test invoice with a single line item"
    echo "  update   Update invoice metadata (status, due date, terms)"
    echo "  delete   Void and soft-delete an invoice"
    echo "  show     Show invoice details"
    echo ""
    echo -e "${YELLOW}OPTIONS BY COMMAND${NC}"
    echo "  create:  -a|--account <name>, [-s|--status], [-d|--description],"
    echo "           [--amount <num>], [-e|--env]"
    echo "  update:  <id>, [--status <status>],[--due-date <YYYY-MM-DD>],"
    echo "[--payment-terms <terms>], [-e|--env]"
    echo "  delete:  <id>,[--ticket <ticket_id>], [-e|--env]"
    echo "  show:    <id>,[-e|--env]"
    echo ""
    echo -e "${YELLOW}EXAMPLES${NC}"
    echo "  sanctum.sh invoice create -a \"Digital Sanctum\" -d \"QA Test\" --amount 150"
    echo "  sanctum.sh invoice delete 8b4a2c -e prod"
    echo ""
    exit 0
}

article_usage() {
    echo ""
    echo -e "${BLUE}sanctum.sh article — Manage Knowledge Base Articles${NC}"
    echo ""
    echo "Usage: sanctum.sh article <command> [options]"
    echo ""
    echo -e "${YELLOW}COMMANDS${NC}"
    echo "  create   Create a new article"
    echo "  update   Update an existing article"
    echo "  show     Show article details"
    echo "  relate   Link one or more related articles"
    echo "  unrelate Unlink a related article"
    echo ""
    echo -e "${YELLOW}OPTIONS BY COMMAND${NC}"
    echo "  create:  -t|--title <text>, --slug <text>, --category <category>,"
    echo "           [-f|--file <path>], [--related <id1,id2,...>], [-e|--env]"
    echo "  update:  <uuid|identifier>, [-f|--file <path>], [-t|--title <text>],"
    echo "           [--related <id1,id2,...>], [-e|--env]"
    echo "  show:    <slug|identifier>, [-c|--content], [-e|--env]"
    echo "  relate:  <uuid|identifier> --related <id1,id2,...>, [-e|--env]"
    echo "  unrelate:<uuid|identifier> --related <id>, [-e|--env]"
    echo ""
    echo -e "${YELLOW}CATEGORIES${NC}"
    echo "  Standard Operating Procedure, System Documentation, Developer Documentation,"
    echo "  Troubleshooting Guide, General Knowledge, Template"
    echo ""
    echo -e "${YELLOW}EXAMPLES${NC}"
    echo "  sanctum.sh article create -t \"My Doc\" --slug my-doc --category \"Template\" -f doc.md"
    echo "  sanctum.sh article create -t \"My Doc\" --slug my-doc --category \"Template\" -f doc.md --related \"DOC-001,WIKI-002\""
    echo "  sanctum.sh article update DOC-012 -f updated_doc.md --related \"DOC-001\""
    echo "  sanctum.sh article relate DOC-012 --related \"DOC-001,WIKI-002\" -e prod"
    echo "  sanctum.sh article unrelate DOC-012 --related DOC-001 -e prod"
    echo "  sanctum.sh article show DOC-012 -c"
    echo ""
    exit 0
}

# ─────────────────────────────────────────────
# SHARED HELPER: Resolve article identifier or UUID
# Usage: ARTICLE_UUID=$(resolve_article_identifier "DOC-012")
# ─────────────────────────────────────────────
resolve_article_identifier() {
    local INPUT="$1"
    if [[ "$INPUT" =~ ^[A-Z]+-[0-9]+$ ]]; then
        local ARTICLES RESOLVED
        ARTICLES=$(api_get "/articles")
        RESOLVED=$(echo "$ARTICLES" | jq -r --arg id "$INPUT" '.[] | select(.identifier == $id) | .id // empty')
        if [ -z "$RESOLVED" ]; then
            echo -e "${RED}✗ No article found with identifier: ${INPUT}${NC}" >&2
            return 1
        fi
        echo "$RESOLVED"
    else
        echo "$INPUT"
    fi
}

# ─────────────────────────────────────────────
# TICKET DOMAIN
# ─────────────────────────────────────────────
ticket_create() {
    local SUBJECT="" DESCRIPTION="" PRIORITY="normal" TICKET_TYPE="task"
    local PROJECT_NAME="" MILESTONE_NAME="" ACCOUNT_NAME="" ENV="dev"
    local ARTICLES=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            -s|--subject)     SUBJECT="$2"; shift 2 ;;
            -d|--description) DESCRIPTION="$2"; shift 2 ;;
            -p|--project)     PROJECT_NAME="$2"; shift 2 ;;
            -m|--milestone)   MILESTONE_NAME="$2"; shift 2 ;;
            -a|--account)     ACCOUNT_NAME="$2"; shift 2 ;;
            -e|--env)         ENV="$2"; shift 2 ;;
            --priority)       PRIORITY="$2"; shift 2 ;;
            --type)           TICKET_TYPE="$2"; shift 2 ;;
            --articles)       ARTICLES="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    [ -z "$SUBJECT" ] && echo -e "${RED}✗ -s/--subject is required${NC}" && exit 1
    [ -z "$PROJECT_NAME" ] && [ -z "$ACCOUNT_NAME" ] && echo -e "${RED}✗ -p/--project or -a/--account is required${NC}" && exit 1

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket create"
    ensure_auth

    ACCOUNT_ID=""; MILESTONE_ID=""; PROJECT_DISPLAY=""; MILESTONE_DISPLAY=""

    if [ -n "$PROJECT_NAME" ]; then
        resolve_project "$PROJECT_NAME" || exit 1
        if [ -n "$MILESTONE_NAME" ]; then
            resolve_milestone "$MILESTONE_NAME" "$PROJECT_ID" || exit 1
        fi
    else
        resolve_account "$ACCOUNT_NAME" || exit 1
    fi

    confirm_prod "About to create ticket: ${SUBJECT}"

    echo -e "${YELLOW}→ Creating ticket...${NC}"

    PAYLOAD=$(jq -n \
        --arg account_id "$ACCOUNT_ID" \
        --arg subject "$SUBJECT" \
        --arg description "$DESCRIPTION" \
        --arg priority "$PRIORITY" \
        --arg ticket_type "$TICKET_TYPE" \
        --arg milestone_id "$MILESTONE_ID" \
        '{account_id: $account_id, subject: $subject, priority: $priority, ticket_type: $ticket_type}
        | if $description != "" then .description = $description else . end
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
    [ -n "$PROJECT_DISPLAY" ]   && echo -e "  Project:  ${BLUE}${PROJECT_DISPLAY}${NC}"
    [ -n "$MILESTONE_DISPLAY" ] && echo -e "  Milestone:${BLUE} ${MILESTONE_DISPLAY}${NC}"
    echo ""
    [ "$_SANCTUM_ENV" = "prod" ] \
        && echo -e "${GRAY}View: https://app.digitalsanctum.com.au/tickets/${TICKET_ID}${NC}" \
        || echo -e "${GRAY}View: http://localhost:5173/tickets/${TICKET_ID}${NC}"
    echo ""

    # Link articles if --articles provided
    if [ -n "$ARTICLES" ]; then
        echo -e "${YELLOW}-> Linking articles...${NC}"
        IFS=',' read -ra ARTICLE_LIST <<< "$ARTICLES"
        for RAW_ID in "${ARTICLE_LIST[@]}"; do
            RAW_ID=$(echo "$RAW_ID" | tr -d ' ')
            ARTICLE_UUID=$(resolve_article_identifier "$RAW_ID") || continue
            api_post "/tickets/${TICKET_ID}/articles/${ARTICLE_UUID}" '{}' > /dev/null
            echo -e "${GREEN}  Linked article: ${RAW_ID}${NC}"
        done
    fi
}

ticket_comment() {
    local TICKET_ID="$1"; shift
    local BODY="" STATUS="" VISIBILITY="internal" ENV="dev"

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -b|--body)       BODY="$2"; shift 2 ;;
            --status)        STATUS="$2"; shift 2 ;;
            --visibility)    VISIBILITY="$2"; shift 2 ;;
            -e|--env)        ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    [ -z "$BODY" ] && echo -e "${RED}✗ -b/--body is required${NC}" && exit 1

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket comment"
    ensure_auth
    confirm_prod "About to comment on ticket #${TICKET_ID}"

    PAYLOAD=$(jq -n \
        --argjson ticket_id "$TICKET_ID" \
        --arg body "$BODY" \
        --arg visibility "$VISIBILITY" \
        --arg status "$STATUS" \
        '{ticket_id: $ticket_id, body: $body, visibility: $visibility}
        | if $status != "" then .status = $status else . end')

    RESULT=$(api_post "/comments" "$PAYLOAD")
    COMMENT_ID=$(echo "$RESULT" | jq -r '.id // empty')

    if [ -z "$COMMENT_ID" ]; then
        echo -e "${RED}✗ Failed to post comment${NC}"
        echo "$RESULT" | jq
        exit 1
    fi

    echo ""
    echo -e "${GREEN}✓ Comment posted on Ticket #${TICKET_ID}${NC}"
    [ -n "$STATUS" ] && echo -e "  Status updated to: ${BLUE}${STATUS}${NC}"
    echo ""
}

ticket_resolve() {
    local TICKET_ID="$1"; shift
    local BODY="" VISIBILITY="internal" ENV="dev"

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -b|--body)       BODY="$2"; shift 2 ;;
            --visibility)    VISIBILITY="$2"; shift 2 ;;
            -e|--env)        ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    [ -z "$BODY" ] && echo -e "${RED}✗ -b/--body is required${NC}" && exit 1

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket resolve"
    ensure_auth
    confirm_prod "About to resolve ticket #${TICKET_ID}"

    # Step 1: Post the resolution comment
    echo -e "${YELLOW}→ Posting resolution comment...${NC}"
    COMMENT_PAYLOAD=$(jq -n         --argjson ticket_id "$TICKET_ID"         --arg body "$BODY"         --arg visibility "$VISIBILITY"         '{ticket_id: $ticket_id, body: $body, visibility: $visibility}')

    COMMENT_RESULT=$(api_post "/comments" "$COMMENT_PAYLOAD")
    COMMENT_ID=$(echo "$COMMENT_RESULT" | jq -r '.id // empty')

    if [ -z "$COMMENT_ID" ]; then
        echo -e "${RED}✗ Failed to post resolution comment${NC}"
        echo "$COMMENT_RESULT" | jq
        exit 1
    fi
    echo -e "${GREEN}  ✓ Comment posted (${COMMENT_ID})${NC}"

    # Step 2: Update ticket — status, resolution text, resolution_comment_id
    echo -e "${YELLOW}→ Updating ticket status to resolved...${NC}"
    TICKET_PAYLOAD=$(jq -n         --arg status "resolved"         --arg resolution "$BODY"         --arg resolution_comment_id "$COMMENT_ID"         '{status: $status, resolution: $resolution, resolution_comment_id: $resolution_comment_id}')

    TICKET_RESULT=$(api_put "/tickets/${TICKET_ID}" "$TICKET_PAYLOAD")
    TICKET_STATUS=$(echo "$TICKET_RESULT" | jq -r '.status // empty')

    if [ "$TICKET_STATUS" != "resolved" ]; then
        echo -e "${RED}✗ Failed to update ticket status${NC}"
        echo "$TICKET_RESULT" | jq
        exit 1
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Ticket #${TICKET_ID} Resolved${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  Status:     ${BLUE}resolved${NC}"
    echo -e "  Comment ID: ${GRAY}${COMMENT_ID}${NC}"
    echo ""
}

ticket_show() {
    local TICKET_ID="$1"; shift
    local ENV="dev" SHOW_CONTENT=false SHOW_RELATIONS=false

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)       ENV="$2"; shift 2 ;;
            -c|--content)   SHOW_CONTENT=true; shift ;;
            -r|--relations) SHOW_RELATIONS=true; shift ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket show"
    ensure_auth

    RESULT=$(api_get "/tickets/${TICKET_ID}")

    echo ""
    BASE_FIELDS='{id, subject, status, priority, ticket_type, account_name, milestone_name, project_name, assigned_tech_id, created_at, updated_at}'
    CONTENT_FIELDS='{id, subject, status, priority, ticket_type, description, account_name, milestone_name, project_name, assigned_tech_id, created_at, updated_at}'
    RELATION_FIELDS='{id, subject, status, priority, ticket_type, account_name, milestone_name, project_name, assigned_tech_id, created_at, updated_at, related_tickets, articles}'
    FULL_FIELDS='{id, subject, status, priority, ticket_type, description, account_name, milestone_name, project_name, assigned_tech_id, created_at, updated_at, related_tickets, articles}'

    if [ "$SHOW_CONTENT" = true ] && [ "$SHOW_RELATIONS" = true ]; then
        echo "$RESULT" | jq "$FULL_FIELDS"
    elif [ "$SHOW_CONTENT" = true ]; then
        echo "$RESULT" | jq "$CONTENT_FIELDS"
    elif [ "$SHOW_RELATIONS" = true ]; then
        echo "$RESULT" | jq "$RELATION_FIELDS"
    else
        echo "$RESULT" | jq "$BASE_FIELDS"
    fi
    echo ""
}

ticket_list() {
    local MILESTONE=""
    local PROJECT=""
    local STATUS=""
    local ENV="dev"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -m|--milestone) MILESTONE="$2"; shift 2 ;;
            -p|--project)   PROJECT="$2"; shift 2 ;;
            --status)       STATUS="$2"; shift 2 ;;
            -e|--env)       ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket list"
    ensure_auth

    local MILESTONE_FILTER=""
    if [ -n "$MILESTONE" ]; then
        if [ -n "$PROJECT" ]; then
            resolve_project "$PROJECT"
        else
            resolve_project "Sanctum Core"
        fi
        resolve_milestone "$MILESTONE" "$PROJECT_ID"
        MILESTONE_FILTER="$MILESTONE_ID"
    fi

    RESULT=$(api_get "/tickets")

    echo ""
    if [ -n "$MILESTONE_FILTER" ]; then
        echo -e "${BLUE}Milestone: ${MILESTONE_DISPLAY}${NC}"
        echo ""
        echo "$RESULT" | jq --arg mid "$MILESTONE_FILTER"             '[.[] | select(.milestone_id == $mid) | {id, subject, status, priority, ticket_type}]'
    elif [ -n "$STATUS" ]; then
        echo "$RESULT" | jq --arg s "$STATUS"             '[.[] | select(.status == $s) | {id, subject, status, priority, ticket_type}]'
    else
        echo "$RESULT" | jq '[.[] | {id, subject, status, priority, ticket_type}]'
    fi
    echo ""
}

ticket_delete() {
    local TICKET_ID="$1"; shift
    local ENV="dev"

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env) ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket delete"
    ensure_auth
    confirm_prod "About to soft-delete ticket #${TICKET_ID}"

    RESULT=$(api_delete "/tickets/${TICKET_ID}")
    STATUS=$(echo "$RESULT" | jq -r '.status // empty')

    if [ "$STATUS" = "archived" ]; then
        echo -e "${GREEN}✓ Ticket #${TICKET_ID} archived (soft-deleted)${NC}"
    else
        echo -e "${RED}✗ Unexpected response${NC}"
        echo "$RESULT" | jq
        exit 1
    fi
}
ticket_update() {
    local TICKET_ID="$1"; shift
    local SUBJECT="" DESCRIPTION="" STATUS="" PRIORITY="" TICKET_TYPE="" MILESTONE_NAME="" ENV="dev"
    local ARTICLES=""

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -s|--subject)     SUBJECT="$2"; shift 2 ;;
            -d|--description) DESCRIPTION="$2"; shift 2 ;;
            --status)         STATUS="$2"; shift 2 ;;
            --priority)       PRIORITY="$2"; shift 2 ;;
            --type)           TICKET_TYPE="$2"; shift 2 ;;
            -m|--milestone)   MILESTONE_NAME="$2"; shift 2 ;;
            -e|--env)         ENV="$2"; shift 2 ;;
            --articles)       ARTICLES="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket update"
    ensure_auth
    if [ -n "$MILESTONE_NAME" ]; then
        resolve_project "Sanctum Core" || exit 1
        resolve_milestone "$MILESTONE_NAME" "$PROJECT_ID" || exit 1
    fi
    confirm_prod "About to update ticket #${TICKET_ID}"

    PAYLOAD=$(jq -n \
        --arg subject "$SUBJECT" \
        --arg description "$DESCRIPTION" \
        --arg status "$STATUS" \
        --arg priority "$PRIORITY" \
        --arg ticket_type "$TICKET_TYPE" \
        --arg milestone_id "$MILESTONE_ID" \
        '{}
        | if $subject != "" then .subject = $subject else . end
        | if $description != "" then .description = $description else . end
        | if $status != "" then .status = $status else . end
        | if $priority != "" then .priority = $priority else . end
        | if $ticket_type != "" then .ticket_type = $ticket_type else . end
        | if $milestone_id != "" then .milestone_id = $milestone_id else . end')

    RESULT=$(api_put "/tickets/${TICKET_ID}" "$PAYLOAD")
    UPDATED_ID=$(echo "$RESULT" | jq -r '.id // empty')

    if [ -z "$UPDATED_ID" ]; then
        echo -e "${RED}✗ Failed to update ticket${NC}"
        echo "$RESULT" | jq
        exit 1
    fi

    echo ""
    echo -e "${GREEN}✓ Ticket #${TICKET_ID} Updated${NC}"
    echo ""

    # Link articles if --articles provided
    if [ -n "$ARTICLES" ]; then
        echo -e "${YELLOW}-> Linking articles...${NC}"
        IFS=',' read -ra ARTICLE_LIST <<< "$ARTICLES"
        for RAW_ID in "${ARTICLE_LIST[@]}"; do
            RAW_ID=$(echo "$RAW_ID" | tr -d ' ')
            ARTICLE_UUID=$(resolve_article_identifier "$RAW_ID") || continue
            api_post "/tickets/${TICKET_ID}/articles/${ARTICLE_UUID}" '{}' > /dev/null
            echo -e "${GREEN}  Linked article: ${RAW_ID}${NC}"
        done
    fi
}

# ─────────────────────────────────────────────
# TICKET RELATE / UNRELATE
# ─────────────────────────────────────────────
ticket_relate() {
    local TICKET_ID="$1"; shift
    local ARTICLES="" ENV="dev"
    [ -z "$TICKET_ID" ] && echo -e "${RED}Ticket ID is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            --articles) ARTICLES="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
        esac
    done
    [ -z "$ARTICLES" ] && echo -e "${RED}--articles is required${NC}" && exit 1
    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket relate"
    ensure_auth
    confirm_prod "About to link articles to ticket #${TICKET_ID}"
    echo -e "${YELLOW}-> Linking articles...${NC}"
    IFS=',' read -ra ARTICLE_LIST <<< "$ARTICLES"
    for RAW_ID in "${ARTICLE_LIST[@]}"; do
        RAW_ID=$(echo "$RAW_ID" | tr -d ' ')
        ARTICLE_UUID=$(resolve_article_identifier "$RAW_ID") || continue
        api_post "/tickets/${TICKET_ID}/articles/${ARTICLE_UUID}" '{}' > /dev/null
        echo -e "${GREEN}  Linked: ${RAW_ID}${NC}"
    done
    echo ""
}

ticket_relate_tickets() {
    local TICKET_ID="$1"; shift
    local TICKETS="" RELATION_TYPE="relates_to" VISIBILITY="internal" ENV="dev"
    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            --tickets)      TICKETS="$2"; shift 2 ;;
            --type)         RELATION_TYPE="$2"; shift 2 ;;
            --visibility)   VISIBILITY="$2"; shift 2 ;;
            -e|--env)       ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done
    [ -z "$TICKETS" ] && echo -e "${RED}✗ --tickets is required${NC}" && exit 1
    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket relate-tickets"
    ensure_auth
    confirm_prod "About to link tickets to ticket #${TICKET_ID}"
    echo -e "${YELLOW}→ Linking tickets...${NC}"
    IFS=',' read -ra TICKET_LIST <<< "$TICKETS"
    for RELATED_ID in "${TICKET_LIST[@]}"; do
        RELATED_ID=$(echo "$RELATED_ID" | tr -d ' ')
        PAYLOAD=$(jq -n --arg rid "$RELATED_ID" --arg rt "$RELATION_TYPE" --arg vis "$VISIBILITY"             '{"related_id": ($rid | tonumber), "relation_type": $rt, "visibility": $vis}')
        RESULT=$(api_post "/tickets/${TICKET_ID}/relations" "$PAYLOAD")
        STATUS=$(echo "$RESULT" | jq -r '.status // "error"')
        if [ "$STATUS" = "linked" ]; then
            echo -e "${GREEN}  Linked: #${RELATED_ID}${NC}"
        elif [ "$STATUS" = "already_exists" ]; then
            echo -e "${YELLOW}  Already linked: #${RELATED_ID}${NC}"
        else
            echo -e "${RED}  Failed: #${RELATED_ID}${NC}"
        fi
    done
    echo ""
}
ticket_unrelate_ticket() {
    local TICKET_ID="$1"; shift
    local RELATED_ID="" ENV="dev"
    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            --ticket)   RELATED_ID="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done
    [ -z "$RELATED_ID" ] && echo -e "${RED}✗ --ticket is required${NC}" && exit 1
    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket unrelate-ticket"
    ensure_auth
    confirm_prod "About to unlink ticket #${RELATED_ID} from ticket #${TICKET_ID}"
    api_delete "/tickets/${TICKET_ID}/relations/${RELATED_ID}" > /dev/null
    echo -e "${GREEN}✓ Unlinked: #${RELATED_ID} from ticket #${TICKET_ID}${NC}"
    echo ""
}
ticket_unrelate() {
    local TICKET_ID="$1"; shift
    local ARTICLE="" ENV="dev"
    [ -z "$TICKET_ID" ] && echo -e "${RED}Ticket ID is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            --article)  ARTICLE="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
        esac
    done
    [ -z "$ARTICLE" ] && echo -e "${RED}--article is required${NC}" && exit 1
    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket unrelate"
    ensure_auth
    ARTICLE_UUID=$(resolve_article_identifier "$ARTICLE") || exit 1
    confirm_prod "About to unlink article ${ARTICLE} from ticket #${TICKET_ID}"
    api_delete "/tickets/${TICKET_ID}/articles/${ARTICLE_UUID}" > /dev/null
    echo -e "${GREEN}Unlinked: ${ARTICLE} from ticket #${TICKET_ID}${NC}"
    echo ""
}

# ─────────────────────────────────────────────
# MILESTONE DOMAIN
# ─────────────────────────────────────────────
milestone_create() {
    local PROJECT_NAME="" NAME="" DUE_DATE="" BILLABLE="0" SEQUENCE="" ENV="dev"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--project)   PROJECT_NAME="$2"; shift 2 ;;
            -n|--name)      NAME="$2"; shift 2 ;;
            --due-date)     DUE_DATE="$2"; shift 2 ;;
            --billable)     BILLABLE="$2"; shift 2 ;;
            --sequence)     SEQUENCE="$2"; shift 2 ;;
            --description)  DESCRIPTION="$2"; shift 2 ;;
            -e|--env)       ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    [ -z "$PROJECT_NAME" ] && echo -e "${RED}✗ -p/--project is required${NC}" && exit 1
    [ -z "$NAME" ] && echo -e "${RED}✗ -n/--name is required${NC}" && exit 1

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — milestone create"
    ensure_auth
    resolve_project "$PROJECT_NAME" || exit 1
    if [ -z "$SEQUENCE" ]; then
        local PROJECT_DETAIL
        PROJECT_DETAIL=$(api_get "/projects/${PROJECT_ID}")
        local MAX_SEQ
        MAX_SEQ=$(echo "$PROJECT_DETAIL" | jq '[.milestones[].sequence] | if length == 0 then 0 else max end')
        SEQUENCE=$((MAX_SEQ + 1))
        echo -e "${GRAY}  → Auto-sequence: ${SEQUENCE}${NC}"
    fi
    confirm_prod "About to create milestone: ${NAME}"

    PAYLOAD=$(jq -n         --arg name "$NAME"         --arg due_date "$DUE_DATE"         --arg billable_amount "$BILLABLE"         --argjson sequence "$SEQUENCE"         --arg description "$DESCRIPTION"         '{name: $name, sequence: $sequence, billable_amount: $billable_amount, description: $description}
        | if $due_date != "" then .due_date = $due_date else . end')

    RESULT=$(api_post "/projects/${PROJECT_ID}/milestones" "$PAYLOAD")
    MILESTONE_ID=$(echo "$RESULT" | jq -r '.id // empty')

    if [ -z "$MILESTONE_ID" ]; then
        echo -e "${RED}✗ Failed to create milestone${NC}"
        echo "$RESULT" | jq; exit 1
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Milestone Created${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  Name:     ${BLUE}${NAME}${NC}"
    echo -e "  Project:  ${BLUE}${PROJECT_DISPLAY}${NC}"
    echo -e "  ID:       ${GRAY}${MILESTONE_ID}${NC}"
    echo ""
}

milestone_update() {
    local MILESTONE_ID="$1"; shift
    local NAME="" STATUS="" DUE_DATE="" BILLABLE="" SEQUENCE="" ENV="dev"

    [ -z "$MILESTONE_ID" ] && echo -e "${RED}✗ Milestone ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -n|--name)      NAME="$2"; shift 2 ;;
            --status)       STATUS="$2"; shift 2 ;;
            --due-date)     DUE_DATE="$2"; shift 2 ;;
            --billable)     BILLABLE="$2"; shift 2 ;;
            --sequence)     SEQUENCE="$2"; shift 2 ;;
            --description)  DESCRIPTION="$2"; shift 2 ;;
            -e|--env)       ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — milestone update"
    ensure_auth
    confirm_prod "About to update milestone: ${MILESTONE_ID}"

    PAYLOAD=$(jq -n         --arg name "$NAME"         --arg status "$STATUS"         --arg due_date "$DUE_DATE"         --arg billable_amount "$BILLABLE"         --arg sequence "$SEQUENCE"         --arg description "$DESCRIPTION"         '{}
        | if $name != "" then .name = $name else . end
        | if $status != "" then .status = $status else . end
        | if $due_date != "" then .due_date = $due_date else . end
        | if $billable_amount != "" then .billable_amount = $billable_amount else . end
        | if $sequence != "" then .sequence = ($sequence | tonumber) else . end
        | if $description != "" then .description = $description else . end')

    RESULT=$(api_put "/milestones/${MILESTONE_ID}" "$PAYLOAD")
    UPDATED_ID=$(echo "$RESULT" | jq -r '.id // empty')

    if [ -z "$UPDATED_ID" ]; then
        echo -e "${RED}✗ Failed to update milestone${NC}"
        echo "$RESULT" | jq; exit 1
    fi

    echo ""
    echo -e "${GREEN}✓ Milestone updated: ${MILESTONE_ID}${NC}"
    echo ""
}

milestone_list() {
    local PROJECT_NAME="" ENV="dev"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--project)   PROJECT_NAME="$2"; shift 2 ;;
            -e|--env)       ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    [ -z "$PROJECT_NAME" ] && echo -e "${RED}✗ -p/--project is required${NC}" && exit 1

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — milestone list"
    ensure_auth
    resolve_project "$PROJECT_NAME" || exit 1

    RESULT=$(api_get "/projects/${PROJECT_ID}")
    echo ""
    echo -e "${BLUE}Milestones: ${PROJECT_DISPLAY}${NC}"
    echo ""
    echo "$RESULT" | jq -r '.milestones | sort_by(.sequence) | .[] | "  [\(.sequence)] \(.name) — \(.status) (ID: \(.id))"'
    echo ""
}

milestone_show() {
    local MILESTONE_ID="$1"; shift
    local ENV="dev"

    [ -z "$MILESTONE_ID" ] && echo -e "${RED}✗ Milestone ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)     ENV="$2"; shift 2 ;;
            -c|--content) SHOW_CONTENT=true; shift ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — milestone show"
    ensure_auth

    # Milestone show — fetch via project list and find by ID
    echo -e "${YELLOW}→ Looking up milestone ${MILESTONE_ID}...${NC}"
    PROJECTS=$(api_get "/projects")
    MILESTONE=$(echo "$PROJECTS" | jq -r --arg mid "$MILESTONE_ID"         '[.[].milestones[] | select(.id == $mid)] | first // empty')

    if [ -z "$MILESTONE" ] || [ "$MILESTONE" = "null" ]; then
        echo -e "${RED}✗ Milestone not found: ${MILESTONE_ID}${NC}"
        exit 1
    fi

    echo ""
    echo "$MILESTONE" | jq '{id, name, status, due_date, billable_amount, sequence}'
    echo ""
}

# ─────────────────────────────────────────────
# INVOICE DOMAIN
# ─────────────────────────────────────────────
invoice_create() {
    local ACCOUNT_NAME="" STATUS="sent" DESCRIPTION="QA Test Invoice" AMOUNT="100" ENV="dev"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -a|--account)     ACCOUNT_NAME="$2"; shift 2 ;;
            -s|--status)      STATUS="$2"; shift 2 ;;
            -d|--description) DESCRIPTION="$2"; shift 2 ;;
            --amount)         AMOUNT="$2"; shift 2 ;;
            -e|--env)         ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    [ -z "$ACCOUNT_NAME" ] && echo -e "${RED}✗ -a/--account is required${NC}" && exit 1

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — invoice create"
    ensure_auth
    resolve_account "$ACCOUNT_NAME" || exit 1
    confirm_prod "About to create test invoice for: ${ACCOUNT_DISPLAY}"

    # Step 1: Create invoice directly
    echo -e "${YELLOW}→ Creating invoice...${NC}"
    INVOICE_PAYLOAD=$(jq -n         --arg account_id "$ACCOUNT_ID"         --arg status "$STATUS"         --arg payment_terms "Net 14 Days"         '{account_id: $account_id, status: $status, payment_terms: $payment_terms}')
    INVOICE_RESULT=$(api_post "/invoices" "$INVOICE_PAYLOAD")
    INVOICE_ID=$(echo "$INVOICE_RESULT" | jq -r '.id // empty')
    if [ -z "$INVOICE_ID" ]; then
        echo -e "${RED}✗ Failed to create invoice${NC}"
        echo "$INVOICE_RESULT" | jq; exit 1
    fi
    echo -e "${GREEN}  ✓ Invoice created (${INVOICE_ID:0:8})${NC}"

    # Step 2: Add line item
    echo -e "${YELLOW}→ Adding line item (${DESCRIPTION} @ \$${AMOUNT})...${NC}"
    ITEM_PAYLOAD=$(jq -n         --arg description "$DESCRIPTION"         --arg unit_price "$AMOUNT"         '{description: $description, quantity: 1, unit_price: $unit_price}')
    api_post "/invoices/${INVOICE_ID}/items" "$ITEM_PAYLOAD" > /dev/null
    echo -e "${GREEN}  ✓ Line item added${NC}"

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Invoice Created${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  Invoice ID: ${BLUE}${INVOICE_ID}${NC}"
    echo -e "  Account:    ${BLUE}${ACCOUNT_DISPLAY}${NC}"
    echo -e "  Status:     ${BLUE}${STATUS}${NC}"
    echo -e "  Amount:     ${BLUE}\$${AMOUNT}${NC}"
    echo ""
    echo -e "${GRAY}To delete: sanctum.sh invoice delete ${INVOICE_ID} -e ${ENV}${NC}"
    echo ""
}

invoice_update() {
    local INVOICE_ID="$1"; shift
    local STATUS="" DUE_DATE="" PAYMENT_TERMS="" ENV="dev"

    [ -z "$INVOICE_ID" ] && echo -e "${RED}✗ Invoice ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            --status)         STATUS="$2"; shift 2 ;;
            --due-date)       DUE_DATE="$2"; shift 2 ;;
            --payment-terms)  PAYMENT_TERMS="$2"; shift 2 ;;
            -e|--env)         ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — invoice update"
    ensure_auth
    confirm_prod "About to update invoice: ${INVOICE_ID}"

    PAYLOAD=$(jq -n         --arg status "$STATUS"         --arg due_date "$DUE_DATE"         --arg payment_terms "$PAYMENT_TERMS"         '{}
        | if $status != "" then .status = $status else . end
        | if $due_date != "" then .due_date = $due_date else . end
        | if $payment_terms != "" then .payment_terms = $payment_terms else . end')

    RESULT=$(api_put "/invoices/${INVOICE_ID}" "$PAYLOAD")
    UPDATED_ID=$(echo "$RESULT" | jq -r '.id // empty')

    if [ -z "$UPDATED_ID" ]; then
        echo -e "${RED}✗ Failed to update invoice${NC}"
        echo "$RESULT" | jq; exit 1
    fi

    echo ""
    echo -e "${GREEN}✓ Invoice updated: ${INVOICE_ID:0:8}${NC}"
    echo ""
}

invoice_delete() {
    local INVOICE_ID="$1"; shift
    local TICKET_ID="" ENV="dev"

    [ -z "$INVOICE_ID" ] && echo -e "${RED}✗ Invoice ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            --ticket) TICKET_ID="$2"; shift 2 ;;
            -e|--env)     ENV="$2"; shift 2 ;;
            -c|--content) SHOW_CONTENT=true; shift ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — invoice delete"
    ensure_auth
    confirm_prod "About to delete invoice: ${INVOICE_ID}"

    # Void first if not already draft or void
    STATUS=$(api_get "/invoices/${INVOICE_ID}" | jq -r '.status // empty')
    if [ "$STATUS" != "draft" ] && [ "$STATUS" != "void" ]; then
        echo -e "${YELLOW}→ Invoice status is '${STATUS}' — voiding first...${NC}"
        api_put "/invoices/${INVOICE_ID}/void" "{}" > /dev/null
        echo -e "${GREEN}  ✓ Voided${NC}"
    fi

    RESULT=$(api_delete "/invoices/${INVOICE_ID}")
    echo -e "${GREEN}✓ Invoice deleted: ${INVOICE_ID:0:8}${NC}"

    if [ -n "$TICKET_ID" ]; then
        echo -e "${YELLOW}→ Soft-deleting source ticket #${TICKET_ID}...${NC}"
        TICKET_RESULT=$(api_delete "/tickets/${TICKET_ID}")
        TICKET_STATUS=$(echo "$TICKET_RESULT" | jq -r '.status // empty')
        if [ "$TICKET_STATUS" = "archived" ]; then
            echo -e "${GREEN}✓ Ticket #${TICKET_ID} archived${NC}"
        else
            echo -e "${YELLOW}⚠ Ticket delete returned unexpected response${NC}"
            echo "$TICKET_RESULT" | jq
        fi
    fi
    echo ""
}

invoice_show() {
    local INVOICE_ID="$1"; shift
    local ENV="dev"

    [ -z "$INVOICE_ID" ] && echo -e "${RED}✗ Invoice ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)     ENV="$2"; shift 2 ;;
            -c|--content) SHOW_CONTENT=true; shift ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — invoice show"
    ensure_auth

    RESULT=$(api_get "/invoices/${INVOICE_ID}")
    echo ""
    echo "$RESULT" | jq '{id, status, total_amount, account_id, due_date, payment_terms, generated_at, paid_at}'
    echo ""
}

# ─────────────────────────────────────────────
# ARTICLE DOMAIN
# ─────────────────────────────────────────────
article_create() {
    local TITLE="" SLUG="" CATEGORY="" CONTENT_FILE="" ENV="dev"
    local RELATED=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--title)    TITLE="$2"; shift 2 ;;
            --slug)        SLUG="$2"; shift 2 ;;
            --category)    CATEGORY="$2"; shift 2 ;;
            -f|--file)     CONTENT_FILE="$2"; shift 2 ;;
            -e|--env)      ENV="$2"; shift 2 ;;
            --related)     RELATED="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    [ -z "$TITLE" ]    && echo -e "${RED}✗ -t/--title is required${NC}" && exit 1
    [ -z "$SLUG" ]     && echo -e "${RED}✗ --slug is required${NC}" && exit 1
    [ -z "$CATEGORY" ] && echo -e "${RED}✗ --category is required${NC}" && exit 1

    local CONTENT=""
    if [ -n "$CONTENT_FILE" ]; then
        [ ! -f "$CONTENT_FILE" ] && echo -e "${RED}✗ File not found: ${CONTENT_FILE}${NC}" && exit 1
        CONTENT=$(cat "$CONTENT_FILE")
    else
        echo -e "${YELLOW}→ No -f/--file provided. Reading content from stdin (Ctrl+D to finish):${NC}"
        CONTENT=$(cat)
    fi

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — article create"
    ensure_auth
    confirm_prod "About to create article: ${TITLE}"

    PAYLOAD=$(jq -n \
        --arg title "$TITLE" \
        --arg slug "$SLUG" \
        --arg category "$CATEGORY" \
        --arg content "$CONTENT" \
        '{title: $title, slug: $slug, category: $category, content: $content}')

    RESULT=$(api_post "/articles" "$PAYLOAD")
    ARTICLE_ID=$(echo "$RESULT" | jq -r '.id // empty')
    IDENTIFIER=$(echo "$RESULT" | jq -r '.identifier // empty')

    if [ -z "$ARTICLE_ID" ]; then
        echo -e "${RED}✗ Failed to create article${NC}"
        echo "$RESULT" | jq
        exit 1
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Article Created${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  Title:      ${BLUE}${TITLE}${NC}"
    echo -e "  Identifier: ${BLUE}${IDENTIFIER}${NC}"
    echo -e "  Slug:       ${BLUE}${SLUG}${NC}"
    echo -e "  Category:   ${BLUE}${CATEGORY}${NC}"
    echo -e "  UUID:       ${GRAY}${ARTICLE_ID}${NC}"
    echo ""

    # Link related articles if --related provided
    if [ -n "$RELATED" ]; then
        echo -e "${YELLOW}→ Linking related articles...${NC}"
        IFS=',' read -ra RELATED_LIST <<< "$RELATED"
        for RAW_ID in "${RELATED_LIST[@]}"; do
            RAW_ID=$(echo "$RAW_ID" | tr -d ' ')
            RELATED_UUID=$(resolve_article_identifier "$RAW_ID") || continue
            api_post "/articles/${ARTICLE_ID}/relations" "$(jq -n --arg id "${RELATED_UUID}" '{"related_id": $id}')" > /dev/null
            echo -e "${GREEN}  ✓ Linked: ${RAW_ID}${NC}"
        done
    fi
}

article_update() {
    local ARTICLE_ID="$1"; shift
    local CONTENT_FILE="" TITLE="" ENV="dev"
    local RELATED=""

    [ -z "$ARTICLE_ID" ] && echo -e "${RED}✗ Article UUID or identifier is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--file)  CONTENT_FILE="$2"; shift 2 ;;
            -t|--title) TITLE="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            --related)  RELATED="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    local CONTENT=""
    if [ -n "$CONTENT_FILE" ]; then
        [ ! -f "$CONTENT_FILE" ] && echo -e "${RED}✗ File not found: ${CONTENT_FILE}${NC}" && exit 1
        CONTENT=$(cat "$CONTENT_FILE")
    else
        echo -e "${YELLOW}→ No -f/--file provided. Reading content from stdin (Ctrl+D to finish):${NC}"
        CONTENT=$(cat)
    fi

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — article update"
    ensure_auth
    # Resolve identifier (e.g. DOC-012) to UUID if needed
    if [[ "$ARTICLE_ID" =~ ^[A-Z]+-[0-9]+$ ]]; then
        echo -e "${YELLOW}→ Resolving identifier: ${ARTICLE_ID}...${NC}"
        ARTICLES=$(api_get "/articles")
        RESOLVED=$(echo "$ARTICLES" | jq -r --arg id "$ARTICLE_ID" '.[] | select(.identifier == $id) | .id // empty')
        RESOLVED_TITLE=$(echo "$ARTICLES" | jq -r --arg id "$ARTICLE_ID" '.[] | select(.identifier == $id) | .title // empty')
        if [ -z "$RESOLVED" ]; then
            echo -e "${RED}✗ No article found with identifier: ${ARTICLE_ID}${NC}"
            exit 1
        fi
        echo -e "${GREEN}  ✓ Resolved to: ${RESOLVED_TITLE}${NC} ${GRAY}(${RESOLVED})${NC}"
        ARTICLE_ID="$RESOLVED"
    fi
    confirm_prod "About to update article: ${ARTICLE_ID}"

    PAYLOAD=$(jq -n \
        --arg content "$CONTENT" \
        --arg title "$TITLE" \
        '{content: $content} | if $title != "" then .title = $title else . end')

    RESULT=$(api_put "/articles/${ARTICLE_ID}" "$PAYLOAD")
    UPDATED_ID=$(echo "$RESULT" | jq -r '.id // empty')

    if [ -z "$UPDATED_ID" ]; then
        echo -e "${RED}✗ Failed to update article${NC}"
        echo "$RESULT" | jq
        exit 1
    fi

    echo ""
    echo -e "${GREEN}✓ Article updated: ${ARTICLE_ID}${NC}"
    echo ""

    # Link related articles if --related provided
    if [ -n "$RELATED" ]; then
        echo -e "${YELLOW}→ Linking related articles...${NC}"
        IFS=',' read -ra RELATED_LIST <<< "$RELATED"
        for RAW_ID in "${RELATED_LIST[@]}"; do
            RAW_ID=$(echo "$RAW_ID" | tr -d ' ')
            RELATED_UUID=$(resolve_article_identifier "$RAW_ID") || continue
            api_post "/articles/${UPDATED_ID}/relations" "$(jq -n --arg id "${RELATED_UUID}" '{"related_id": $id}')" > /dev/null
            echo -e "${GREEN}  ✓ Linked: ${RAW_ID}${NC}"
        done
    fi
}

# ─────────────────────────────────────────────
# ARTICLE RELATE / UNRELATE
# ─────────────────────────────────────────────
article_relate() {
    local ARTICLE_ID="$1"; shift
    local RELATED="" ENV="dev"
    [ -z "$ARTICLE_ID" ] && echo -e "${RED}✗ Article UUID or identifier is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            --related)  RELATED="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done
    [ -z "$RELATED" ] && echo -e "${RED}✗ --related is required${NC}" && exit 1
    resolve_env "$ENV"
    print_env_banner "sanctum.sh — article relate"
    ensure_auth
    # Resolve source article
    if [[ "$ARTICLE_ID" =~ ^[A-Z]+-[0-9]+$ ]]; then
        ARTICLE_UUID=$(resolve_article_identifier "$ARTICLE_ID") || exit 1
    else
        ARTICLE_UUID="$ARTICLE_ID"
    fi
    confirm_prod "About to link related articles to: ${ARTICLE_ID}"
    echo -e "${YELLOW}→ Linking related articles...${NC}"
    IFS=',' read -ra RELATED_LIST <<< "$RELATED"
    for RAW_ID in "${RELATED_LIST[@]}"; do
        RAW_ID=$(echo "$RAW_ID" | tr -d ' ')
        RELATED_UUID=$(resolve_article_identifier "$RAW_ID") || continue
        api_post "/articles/${ARTICLE_UUID}/relations" "$(jq -n --arg id "${RELATED_UUID}" '{"related_id": $id}')" > /dev/null
        echo -e "${GREEN}  ✓ Linked: ${RAW_ID}${NC}"
    done
    echo ""
}

article_unrelate() {
    local ARTICLE_ID="$1"; shift
    local RELATED="" ENV="dev"
    [ -z "$ARTICLE_ID" ] && echo -e "${RED}✗ Article UUID or identifier is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            --related)  RELATED="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done
    [ -z "$RELATED" ] && echo -e "${RED}✗ --related is required${NC}" && exit 1
    resolve_env "$ENV"
    print_env_banner "sanctum.sh — article unrelate"
    ensure_auth
    if [[ "$ARTICLE_ID" =~ ^[A-Z]+-[0-9]+$ ]]; then
        ARTICLE_UUID=$(resolve_article_identifier "$ARTICLE_ID") || exit 1
    else
        ARTICLE_UUID="$ARTICLE_ID"
    fi
    RELATED_UUID=$(resolve_article_identifier "$RELATED") || exit 1
    confirm_prod "About to unlink ${RELATED} from ${ARTICLE_ID}"
    api_delete "/articles/${ARTICLE_UUID}/relations/${RELATED_UUID}" > /dev/null
    echo -e "${GREEN}✓ Unlinked: ${RELATED} from ${ARTICLE_ID}${NC}"
    echo ""
}

article_show() {
    local QUERY="$1"; shift
    local ENV="dev"

    [ -z "$QUERY" ] && echo -e "${RED}✗ Slug or identifier is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)     ENV="$2"; shift 2 ;;
            -c|--content) SHOW_CONTENT=true; shift ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — article show"
    ensure_auth

    # Detect if query looks like an identifier (e.g. DOC-002, SYS-007, WIKI-024)
    if [[ "$QUERY" =~ ^[A-Z]+-[0-9]+$ ]]; then
        echo -e "${YELLOW}→ Looking up by identifier: ${QUERY}...${NC}"
        RESULT=$(api_get "/articles" | jq --arg id "$QUERY" '.[] | select(.identifier == $id)')
    else
        echo -e "${YELLOW}→ Looking up by slug: ${QUERY}...${NC}"
        RESULT=$(api_get "/articles/${QUERY}")
    fi

    if [ -z "$RESULT" ] || [ "$RESULT" = "null" ]; then
        echo -e "${RED}✗ Article not found: ${QUERY}${NC}"
        exit 1
    fi
    echo ""
    if [ "$SHOW_CONTENT" = true ]; then
        echo "$RESULT" | jq '{id, identifier, title, slug, category, version, author_id, created_at, updated_at, content}'
    else
        echo "$RESULT" | jq '{id, identifier, title, slug, category, version, author_id, created_at, updated_at}'
    fi
    echo ""
}
# ─────────────────────────────────────────────
# DISPATCH
# ─────────────────────────────────────────────
DOMAIN="${1:-}"
COMMAND="${2:-}"

[ -z "$DOMAIN" ] && usage
[ "$DOMAIN" = "-h" ] || [ "$DOMAIN" = "--help" ] && usage

case "$DOMAIN" in
    ticket)
        shift 2 || true
        case "$COMMAND" in
            -h|--help) ticket_usage ;;
            create)   ticket_create "$@" ;;
            update)   ticket_update "$@" ;;
            comment)  ticket_comment "$@" ;;
            resolve)  ticket_resolve "$@" ;;
            list)     ticket_list "$@" ;;
            show)     ticket_show "$@" ;;
            delete)   ticket_delete "$@" ;;
            relate)          ticket_relate "$@" ;;
            unrelate)        ticket_unrelate "$@" ;;
            relate-tickets)  ticket_relate_tickets "$@" ;;
            unrelate-ticket) ticket_unrelate_ticket "$@" ;;
            *)
                echo -e "${RED}✗ Unknown ticket command: ${COMMAND}${NC}"
                echo "  Valid commands: create, update, comment, resolve, list, show, delete, relate, unrelate, relate-tickets, unrelate-ticket"
                exit 1
                ;;
        esac
        ;;
    milestone)
        shift 2 || true
        case "$COMMAND" in
            -h|--help) milestone_usage ;;
            create)  milestone_create "$@" ;;
            update)  milestone_update "$@" ;;
            list)    milestone_list "$@" ;;
            show)    milestone_show "$@" ;;
            *)
                echo -e "${RED}✗ Unknown milestone command: ${COMMAND}${NC}"
                echo "  Valid commands: create, update, list, show"
                exit 1
                ;;
        esac
        ;;
    invoice)
        shift 2 || true
        case "$COMMAND" in
            -h|--help) invoice_usage ;;
            create)  invoice_create "$@" ;;
            update)  invoice_update "$@" ;;
            delete)  invoice_delete "$@" ;;
            show)    invoice_show "$@" ;;
            *)
                echo -e "${RED}✗ Unknown invoice command: ${COMMAND}${NC}"
                echo "  Valid commands: create, update, delete, show"
                exit 1
                ;;
        esac
        ;;
    article)
        shift 2 || true
        case "$COMMAND" in
            -h|--help)  article_usage ;;
            create)    article_create "$@" ;;
            update)    article_update "$@" ;;
            show)      article_show "$@" ;;
            relate)    article_relate "$@" ;;
            unrelate)  article_unrelate "$@" ;;
            *)
                echo -e "${RED}✗ Unknown article command: ${COMMAND}${NC}"
                echo "  Valid commands: create, update, show, relate, unrelate"
                exit 1
                ;;
        esac
        ;;
    *)
        echo -e "${RED}✗ Unknown domain: ${DOMAIN}${NC}"
        echo "  Valid domains: ticket, milestone, invoice, article"
        exit 1
        ;;
esac

}

main "$@" 2>&1 | tee /dev/tty | sed "s/\x1b\[[0-9;]*m//g" | xclip -selection clipboard -i
