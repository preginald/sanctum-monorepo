#!/bin/bash
# sanctum.sh v1.0 — Unified CLI for Sanctum Core
# Usage: sanctum.sh <domain> <command> [options]
#
# Domains:  ticket, article
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
#   sanctum.sh article show <slug>

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
    echo -e "${YELLOW}TICKET COMMANDS${NC}"
    echo "  ticket create   -s <subject> -p <project> [-m <milestone>] [--type <type>] [--priority <priority>] [-d <description>] [-e dev|prod]"
    echo "  ticket update   <id> [-s <subject>] [-d <description>] [--status <status>] [--priority <priority>] [--type <type>] [-e dev|prod]"
    echo "  ticket comment  <id> -b <body> [--status <status>] [-e dev|prod]"
    echo "  ticket resolve  <id> -b <body> [-e dev|prod]"
    echo "  ticket show     <id> [-e dev|prod]"
    echo "  ticket delete   <id> [-e dev|prod]"
    echo ""
    echo -e "${YELLOW}ARTICLE COMMANDS${NC}"
    echo "  article create  -t <title> --slug <slug> --category <category> [-f <file>] [-e dev|prod]"
    echo "  article update  <uuid> [-f <file>] [-e dev|prod]"
    echo "  article show    <slug> [-e dev|prod]"
    echo ""
    echo -e "${YELLOW}GLOBAL OPTIONS${NC}"
    echo "  -e, --env       dev | prod (default: dev)"
    echo "  -h, --help      Show this help"
    echo ""
    echo -e "${YELLOW}TICKET TYPES${NC}"
    echo "  support, bug, feature, refactor, task, access, maintenance, alert, hotfix, test"
    echo ""
    echo -e "${YELLOW}TICKET STATUSES${NC}"
    echo "  new, open, pending, qa, resolved"
    echo ""
    echo -e "${YELLOW}ARTICLE CATEGORIES${NC}"
    echo "  Standard Operating Procedure, System Documentation, Developer Documentation,"
    echo "  Troubleshooting Guide, General Knowledge, Template"
    echo ""
    echo -e "${YELLOW}AUTH${NC}"
    echo "  Set SANCTUM_API_TOKEN for zero-friction auth. Falls back to saved JWT or interactive prompt."
    echo ""
    exit 0
}

# ─────────────────────────────────────────────
# TICKET DOMAIN
# ─────────────────────────────────────────────
ticket_create() {
    local SUBJECT="" DESCRIPTION="" PRIORITY="normal" TICKET_TYPE="task"
    local PROJECT_NAME="" MILESTONE_NAME="" ACCOUNT_NAME="" ENV="dev"

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
    local ENV="dev"

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env) ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket show"
    ensure_auth

    RESULT=$(api_get "/tickets/${TICKET_ID}")

    echo ""
    echo "$RESULT" | jq '{
        id,
        subject,
        status,
        priority,
        ticket_type,
        account_name,
        milestone_name,
        project_name,
        assigned_tech_id,
        created_at,
        updated_at
    }'
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
    local SUBJECT="" DESCRIPTION="" STATUS="" PRIORITY="" TICKET_TYPE="" ENV="dev"

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -s|--subject)     SUBJECT="$2"; shift 2 ;;
            -d|--description) DESCRIPTION="$2"; shift 2 ;;
            --status)         STATUS="$2"; shift 2 ;;
            --priority)       PRIORITY="$2"; shift 2 ;;
            --type)           TICKET_TYPE="$2"; shift 2 ;;
            -e|--env)         ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket update"
    ensure_auth
    confirm_prod "About to update ticket #${TICKET_ID}"

    PAYLOAD=$(jq -n \
        --arg subject "$SUBJECT" \
        --arg description "$DESCRIPTION" \
        --arg status "$STATUS" \
        --arg priority "$PRIORITY" \
        --arg ticket_type "$TICKET_TYPE" \
        '{}
        | if $subject != "" then .subject = $subject else . end
        | if $description != "" then .description = $description else . end
        | if $status != "" then .status = $status else . end
        | if $priority != "" then .priority = $priority else . end
        | if $ticket_type != "" then .ticket_type = $ticket_type else . end')

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
}


# ─────────────────────────────────────────────
# ARTICLE DOMAIN
# ─────────────────────────────────────────────
article_create() {
    local TITLE="" SLUG="" CATEGORY="" CONTENT_FILE="" ENV="dev"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--title)    TITLE="$2"; shift 2 ;;
            --slug)        SLUG="$2"; shift 2 ;;
            --category)    CATEGORY="$2"; shift 2 ;;
            -f|--file)     CONTENT_FILE="$2"; shift 2 ;;
            -e|--env)      ENV="$2"; shift 2 ;;
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
}

article_update() {
    local ARTICLE_ID="$1"; shift
    local CONTENT_FILE="" TITLE="" ENV="dev"

    [ -z "$ARTICLE_ID" ] && echo -e "${RED}✗ Article UUID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--file)  CONTENT_FILE="$2"; shift 2 ;;
            -t|--title) TITLE="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
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
}

article_show() {
    local QUERY="$1"; shift
    local ENV="dev"

    [ -z "$QUERY" ] && echo -e "${RED}✗ Slug or identifier is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env) ENV="$2"; shift 2 ;;
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
    echo "$RESULT" | jq '{
        id,
        identifier,
        title,
        slug,
        category,
        version,
        author_id,
        created_at,
        updated_at
    }'
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
            create)  ticket_create "$@" ;;
            update)  ticket_update "$@" ;;
            comment) ticket_comment "$@" ;;
            resolve) ticket_resolve "$@" ;;
            show)    ticket_show "$@" ;;
            delete)  ticket_delete "$@" ;;
            *)
                echo -e "${RED}✗ Unknown ticket command: ${COMMAND}${NC}"
                echo "  Valid commands: create, update, comment, resolve, show, delete"
                exit 1
                ;;
        esac
        ;;
    article)
        shift 2 || true
        case "$COMMAND" in
            create)  article_create "$@" ;;
            update)  article_update "$@" ;;
            show)    article_show "$@" ;;
            *)
                echo -e "${RED}✗ Unknown article command: ${COMMAND}${NC}"
                echo "  Valid commands: create, update, show"
                exit 1
                ;;
        esac
        ;;
    *)
        echo -e "${RED}✗ Unknown domain: ${DOMAIN}${NC}"
        echo "  Valid domains: ticket, article"
        exit 1
        ;;
esac

}

main "$@" 2>&1 | tee /dev/tty | sed "s/\x1b\[[0-9;]*m//g" | xclip -selection clipboard -i
