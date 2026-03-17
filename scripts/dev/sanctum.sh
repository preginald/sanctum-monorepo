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
#   sanctum.sh ticket create -s "Fix login" -p "Sanctum Core" --relate-tickets "374:blocks,375"
#   sanctum.sh ticket resolve 250 -b "Fixed and deployed."
#   sanctum.sh ticket update 310 --relate-tickets "374:blocks,375:relates_to"
#   sanctum.sh ticket show 250
#   sanctum.sh ticket delete 250
#   sanctum.sh article create -t "My Article" --slug "my-article" --category "System Documentation" -f content.md
#   sanctum.sh article update <uuid> -f content.md
#   sanctum.sh article show <slug|identifier> [-c] [-e local|prod]

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
source "$SCRIPT_DIR/../lib/sanctum_common.sh"

main() {
# Global cache for article list — avoids redundant GET /articles calls
_ARTICLE_LIST_CACHE=""

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
    echo "  context    Session context loader (batch article reader)"
    echo "  search     Omnisearch — cross-entity fuzzy search"
    echo ""
    echo -e "${YELLOW}GLOBAL OPTIONS${NC}"
    echo "  -e, --env       local | prod (default: prod)"
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
    echo "           [-d|--description <text>], [-f|--file <path>], [--articles <id1,id2,...>],
           [--relate-tickets <id[:type],...>], [-e|--env local|prod]"
    echo "  update:  <id>, [-s|--subject], [-d|--description], [-f|--file <path>], [--status <status>],"
    echo "           [--priority <priority>], [--type <type>], [-m|--milestone <name>],"
    echo "           [--articles <id1,id2,...>], [--relate-tickets <id[:type],...>], [-e|--env]"
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
    echo "  sanctum.sh ticket relate 310 --articles \"DOC-001,WIKI-002\""
    echo "  sanctum.sh ticket unrelate 310 --article DOC-001"
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
    echo "  list:    -p|--project <name>, [--milestone-status open|closed|all],"
    echo "           [--ticket-status open|closed|all|<csv>], [--with-tickets],"
    echo "           [--format text|json], [-e|--env]"
    echo "  show:    <id|name>, [--ticket-status open|closed|all], [--no-tickets], [-e|--env]"
    echo ""
    echo -e "${YELLOW}EXAMPLES${NC}"
    echo "  sanctum.sh milestone create -p \"Sanctum Core\" -n \"Phase 67\" --sequence 49"
    echo "  sanctum.sh milestone list -p \"Sanctum Core\" --milestone-status open --with-tickets"
    echo "  sanctum.sh milestone list -p \"Sanctum Core\" --ticket-status open --format json"
    echo "  sanctum.sh milestone show \"Phase 74: The Foreman\""
    echo "  sanctum.sh milestone show \"Phase 74: The Foreman\" --ticket-status open"
    echo "  sanctum.sh milestone show \"Phase 74: The Foreman\" --no-tickets"
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
    echo "  sanctum.sh invoice delete 8b4a2c"
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
    echo "  unrelate Unlink a related article
  history  List version history for an article
  revert   Revert an article to a previous version"
    echo ""
    echo -e "${YELLOW}OPTIONS BY COMMAND${NC}"
    echo "  create:  -t|--title <text>, --slug <text>, --category <category>,"
    echo "           [-f|--file <path>], [--related <id1,id2,...>], [-e|--env]"
    echo "  update:  <uuid|identifier>, [-f|--file <path>], [-t|--title <text>],"
    echo "           [--related <id1,id2,...>], [--section <heading>], [-e|--env]"
    echo "  show:    <slug|identifier>, [-c|--content], [--headings], [--section <heading>], [-e|--env]"
    echo "  relate:  <uuid|identifier> --related <id1,id2,...>, [-e|--env]"
    echo "  unrelate:<uuid|identifier> --related <id>, [-e|--env]"
    echo "  history: <slug|identifier>, [-n|--page-size <n>], [-e|--env]"
    echo "  revert:  <slug|identifier>, --history-id <id>|--to-version <ver>,"
    echo "           [--fields content,title], [--comment <text>], [-e|--env]"
    echo ""
    echo -e "${YELLOW}CATEGORIES${NC}"
    echo "  Standard Operating Procedure, System Documentation, Developer Documentation,"
    echo "  Troubleshooting Guide, General Knowledge, Template"
    echo ""
    echo -e "${YELLOW}EXAMPLES${NC}"
    echo "  sanctum.sh article create -t \"My Doc\" --slug my-doc --category \"Template\" -f doc.md"
    echo "  sanctum.sh article create -t \"My Doc\" --slug my-doc --category \"Template\" -f doc.md --related \"DOC-001,WIKI-002\""
    echo "  sanctum.sh article update DOC-012 -f updated_doc.md --related \"DOC-001\""
    echo "  sanctum.sh article update DOC-009 --section \"## Milestone Commands\" -f /tmp/section.md"
    echo "  sanctum.sh article relate DOC-012 --related \"DOC-001,WIKI-002\""
    echo "  sanctum.sh article unrelate DOC-012 --related DOC-001"
    echo "  sanctum.sh article history DOC-012"
    echo "  sanctum.sh article revert DOC-012 --to-version v1.3"
    echo "  sanctum.sh article revert DOC-012 --history-id abc123 --fields content --comment 'Rolling back'"
    echo "  sanctum.sh article show DOC-012 -c"
    echo "  sanctum.sh article show DOC-009 --headings"
    echo "  sanctum.sh article show DOC-021 --section \"## Overview\""
    echo ""
    exit 0
}

context_usage() {
    echo ""
    echo -e "${BLUE}sanctum.sh context — Session Context Loader${NC}"
    echo ""
    echo "Usage: sanctum.sh context load <id1,id2,...> [options]"
    echo ""
    echo -e "${YELLOW}COMMANDS${NC}"
    echo "  load     Batch-load articles by identifier or slug, concatenated to clipboard"
    echo ""
    echo -e "${YELLOW}OPTIONS${NC}"
    echo "  --headings       Output only headings per article (table of contents mode)"
    echo "  --format json    Output as JSON array instead of markdown"
    echo "  -e|--env         local | prod (default: prod)"
    echo ""
    echo -e "${YELLOW}EXAMPLES${NC}"
    echo "  sanctum.sh context load DOC-002,DOC-001,DOC-010,TPL-001"
    echo "  sanctum.sh context load DOC-009,SOP-099 --headings"
    echo "  sanctum.sh context load DOC-001,DOC-002 --format json"
    echo ""
    exit 0
}

context_load() {
    local IDENTIFIERS="" ENV="prod" HEADINGS=false FORMAT="markdown"

    # First arg is the identifier list (if not a flag)
    if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^- ]]; then
        IDENTIFIERS="$1"; shift
    fi

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) context_usage; exit 0 ;;
            --headings)  HEADINGS=true; shift ;;
            --format)    FORMAT="$2"; shift 2 ;;
            -e|--env)    ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
        esac
    done

    [ -z "$IDENTIFIERS" ] && echo -e "${RED}✗ Comma-separated article identifiers required${NC}" && exit 1

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — context load"
    ensure_auth

    # Fetch article list once (uses cache from #399)
    fetch_article_list

    IFS=',' read -ra ID_LIST <<< "$IDENTIFIERS"
    local LOADED=0 FAILED=0
    local JSON_OUTPUT="["

    echo -e "${YELLOW}→ Loading ${#ID_LIST[@]} article(s)...${NC}"
    echo ""

    for RAW_ID in "${ID_LIST[@]}"; do
        RAW_ID=$(echo "$RAW_ID" | tr -d ' ')

        # Resolve identifier to article JSON from cache
        local ARTICLE_JSON=""
        if [[ "$RAW_ID" =~ ^[A-Z]+-[0-9]+$ ]]; then
            ARTICLE_JSON=$(echo "$_ARTICLE_LIST_CACHE" | jq -c --arg id "$RAW_ID" '.[] | select(.identifier == $id)')
        else
            ARTICLE_JSON=$(echo "$_ARTICLE_LIST_CACHE" | jq -c --arg slug "$RAW_ID" '.[] | select(.slug == $slug)')
        fi

        if [ -z "$ARTICLE_JSON" ] || [ "$ARTICLE_JSON" = "null" ]; then
            echo -e "${RED}  ✗ Not found: ${RAW_ID}${NC}"
            FAILED=$((FAILED + 1))
            continue
        fi

        local TITLE IDENTIFIER ARTICLE_CONTENT
        TITLE=$(echo "$ARTICLE_JSON" | jq -r '.title')
        IDENTIFIER=$(echo "$ARTICLE_JSON" | jq -r '.identifier // empty')
        ARTICLE_CONTENT=$(echo "$ARTICLE_JSON" | jq -r '.content // empty')

        if [ "$FORMAT" = "json" ]; then
            [ "$LOADED" -gt 0 ] && JSON_OUTPUT="${JSON_OUTPUT},"
            JSON_OUTPUT="${JSON_OUTPUT}$(echo "$ARTICLE_JSON" | jq '{identifier, title, content}')"
        elif [ "$HEADINGS" = true ]; then
            echo -e "${BLUE}=== ${IDENTIFIER:-$RAW_ID}: ${TITLE} ===${NC}"
            echo "$ARTICLE_CONTENT" | grep '^#\{2,3\} '
            echo ""
        else
            echo -e "${BLUE}=== ${IDENTIFIER:-$RAW_ID}: ${TITLE} ===${NC}"
            echo ""
            echo "$ARTICLE_CONTENT"
            echo ""
            echo "---"
            echo ""
        fi

        LOADED=$((LOADED + 1))
        echo -e "${GREEN}  ✓ ${IDENTIFIER:-$RAW_ID}: ${TITLE}${NC}" >&2
    done

    if [ "$FORMAT" = "json" ]; then
        JSON_OUTPUT="${JSON_OUTPUT}]"
        echo "$JSON_OUTPUT" | jq .
    fi

    echo "" >&2
    echo -e "${GREEN}✓ Loaded ${LOADED}/${#ID_LIST[@]} articles${NC}" >&2
    [ "$FAILED" -gt 0 ] && echo -e "${RED}  ✗ ${FAILED} not found${NC}" >&2
    echo "" >&2
}

search_usage() {
    echo ""
    echo -e "${BLUE}sanctum.sh search — Omnisearch CLI${NC}"
    echo ""
    echo "Usage: sanctum.sh search <query> [options]"
    echo ""
    echo -e "${YELLOW}OPTIONS${NC}"
    echo "  -t|--type <type>   Scope search to entity type (ticket, wiki, client, contact, asset, project, milestone, product)"
    echo "  -l|--limit <n>     Max results per entity type (default: 5, max: 20)"
    echo "  -e|--env           local | prod (default: prod)"
    echo ""
    echo -e "${YELLOW}EXAMPLES${NC}"
    echo "  sanctum.sh search phoenix"
    echo "  sanctum.sh search login --type ticket"
    echo "  sanctum.sh search "office 365" --type product --limit 10"
    echo "  sanctum.sh search DOC-009 --type wiki"
    echo ""
    exit 0
}

# ─────────────────────────────────────────────
# SHARED HELPER: Fetch article list (cached)
# Populates _ARTICLE_LIST_CACHE on first call
# ─────────────────────────────────────────────
fetch_article_list() {
    if [ -z "$_ARTICLE_LIST_CACHE" ]; then
        _ARTICLE_LIST_CACHE=$(api_get "/articles")
    fi
}

# ─────────────────────────────────────────────
# SHARED HELPER: Resolve article identifier or UUID
# Usage: ARTICLE_UUID=$(resolve_article_identifier "DOC-012")
# Uses cached article list to avoid redundant API calls
# ─────────────────────────────────────────────
resolve_article_identifier() {
    local INPUT="$1"
    if [[ "$INPUT" =~ ^[A-Z]+-[0-9]+$ ]]; then
        fetch_article_list
        local RESOLVED
        RESOLVED=$(echo "$_ARTICLE_LIST_CACHE" | jq -r --arg id "$INPUT" '.[] | select(.identifier == $id) | .id // empty')
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
    local PROJECT_NAME="" MILESTONE_NAME="" ACCOUNT_NAME="" ENV="prod"
    local ARTICLES=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) ticket_usage; exit 0 ;;
            -s|--subject)     SUBJECT="$2"; shift 2 ;;
            -d|--description) DESCRIPTION="$2"; shift 2 ;;
            -f|--file)        DESC_FILE="$2"; shift 2 ;;
            -p|--project)     PROJECT_NAME="$2"; shift 2 ;;
            -m|--milestone)   MILESTONE_NAME="$2"; shift 2 ;;
            -a|--account)     ACCOUNT_NAME="$2"; shift 2 ;;
            -e|--env)         ENV="$2"; shift 2 ;;
            --priority)       PRIORITY="$2"; shift 2 ;;
            --type)           TICKET_TYPE="$2"; shift 2 ;;
            --articles)       ARTICLES="$2"; shift 2 ;;
            --relate-tickets) RELATE_TICKETS="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
        esac
    done

    if [ -n "$DESC_FILE" ]; then
        [ ! -f "$DESC_FILE" ] && echo -e "${RED}✗ File not found: ${DESC_FILE}${NC}" && exit 1
        DESCRIPTION=$(cat "$DESC_FILE")
    fi
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
    # Link related tickets if --relate-tickets provided
    if [ -n "$RELATE_TICKETS" ]; then
        echo -e "${YELLOW}-> Linking related tickets...${NC}"
        IFS=',' read -ra RELATE_LIST <<< "$RELATE_TICKETS"
        for RELATED_ID in "${RELATE_LIST[@]}"; do
            RELATED_ID=$(echo "$RELATED_ID" | tr -d ' ')
            # Parse optional :type suffix (e.g. "374:blocks" → id=374, type=blocks)
            RELATED_BARE="${RELATED_ID%%:*}"
            RELATION_TYPE="${RELATED_ID##*:}"
            [ "$RELATION_TYPE" = "$RELATED_BARE" ] && RELATION_TYPE="relates_to"
            PAYLOAD=$(jq -n --arg rid "$RELATED_BARE" --arg rt "$RELATION_TYPE" '{"related_id": ($rid | tonumber), "relation_type": $rt, "visibility": "internal"}')
            RESULT=$(api_post "/tickets/${TICKET_ID}/relations" "$PAYLOAD")
            REL_STATUS=$(echo "$RESULT" | jq -r '.status // "error"')
            if [ "$REL_STATUS" = "linked" ]; then
                echo -e "${GREEN}  Linked ticket: #${RELATED_BARE} (${RELATION_TYPE})${NC}"
            elif [ "$REL_STATUS" = "already_exists" ]; then
                echo -e "${YELLOW}  Already linked: #${RELATED_BARE}${NC}"
            else
                echo -e "${RED}  Failed to link: #${RELATED_BARE}${NC}"
            fi
        done
    fi
}


ticket_create_batch() {
    local BATCH_FILE="" ENV="prod"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) echo "Usage: sanctum ticket create-batch -f <json_file> [-e env]"; exit 0 ;;
            -f|--file) BATCH_FILE="$2"; shift 2 ;;
            -e|--env)  ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; exit 1 ;;
        esac
    done

    [ -z "$BATCH_FILE" ] && echo -e "${RED}✗ -f/--file is required${NC}" && exit 1
    [ ! -f "$BATCH_FILE" ] && echo -e "${RED}✗ File not found: ${BATCH_FILE}${NC}" && exit 1

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — ticket create-batch"
    ensure_auth

    # Validate JSON array
    ENTRY_COUNT=$(jq 'if type == "array" then length else error("not an array") end' "$BATCH_FILE" 2>/dev/null)
    if [ $? -ne 0 ] || [ -z "$ENTRY_COUNT" ] || [ "$ENTRY_COUNT" -eq 0 ]; then
        echo -e "${RED}✗ File must contain a non-empty JSON array${NC}"
        exit 1
    fi

    echo -e "${BLUE}→ Validating ${ENTRY_COUNT} ticket(s)...${NC}"

    # Pre-validate all entries
    for i in $(seq 0 $((ENTRY_COUNT - 1))); do
        SUBJECT=$(jq -r ".[$i].subject // empty" "$BATCH_FILE")
        PROJECT=$(jq -r ".[$i].project // empty" "$BATCH_FILE")
        ACCOUNT=$(jq -r ".[$i].account // empty" "$BATCH_FILE")
        if [ -z "$SUBJECT" ]; then
            echo -e "${RED}✗ Entry $((i+1)): missing 'subject'${NC}"
            exit 1
        fi
        if [ -z "$PROJECT" ] && [ -z "$ACCOUNT" ]; then
            echo -e "${RED}✗ Entry $((i+1)): missing 'project' or 'account'${NC}"
            exit 1
        fi
    done
    echo -e "${GREEN}✓ All entries valid${NC}"

    confirm_prod "About to create ${ENTRY_COUNT} ticket(s)"

    # Resolution caches
    declare -A PROJECT_CACHE MILESTONE_CACHE
    local CREATED=0 FAILED=0

    for i in $(seq 0 $((ENTRY_COUNT - 1))); do
        SUBJECT=$(jq -r ".[$i].subject // empty" "$BATCH_FILE")
        PROJECT_NAME=$(jq -r ".[$i].project // empty" "$BATCH_FILE")
        ACCOUNT_NAME=$(jq -r ".[$i].account // empty" "$BATCH_FILE")
        MILESTONE_NAME=$(jq -r ".[$i].milestone // empty" "$BATCH_FILE")
        PRIORITY=$(jq -r ".[$i].priority // \"normal\"" "$BATCH_FILE")
        TICKET_TYPE=$(jq -r ".[$i].type // \"task\"" "$BATCH_FILE")
        DESCRIPTION=$(jq -r ".[$i].description // empty" "$BATCH_FILE")
        DESC_FILE=$(jq -r ".[$i].description_file // empty" "$BATCH_FILE")
        ARTICLES=$(jq -r ".[$i].articles // empty" "$BATCH_FILE")
        RELATE_TICKETS=$(jq -r ".[$i].relate_tickets // empty" "$BATCH_FILE")

        echo ""
        echo -e "${YELLOW}── Ticket $((i+1))/${ENTRY_COUNT}: ${SUBJECT} ──${NC}"

        # Load description from file if specified
        if [ -n "$DESC_FILE" ]; then
            if [ ! -f "$DESC_FILE" ]; then
                echo -e "${RED}  ✗ Description file not found: ${DESC_FILE}${NC}"
                FAILED=$((FAILED + 1))
                continue
            fi
            DESCRIPTION=$(cat "$DESC_FILE")
        fi

        # Resolve project (cached)
        ACCOUNT_ID="" PROJECT_ID="" MILESTONE_ID=""
        PROJECT_DISPLAY="" MILESTONE_DISPLAY=""
        if [ -n "$PROJECT_NAME" ]; then
            if [ -n "${PROJECT_CACHE[$PROJECT_NAME]+x}" ]; then
                eval "${PROJECT_CACHE[$PROJECT_NAME]}"
            else
                resolve_project "$PROJECT_NAME"
                if [ $? -ne 0 ]; then
                    echo -e "${RED}  ✗ Failed to resolve project: ${PROJECT_NAME}${NC}"
                    FAILED=$((FAILED + 1))
                    continue
                fi
                PROJECT_CACHE[$PROJECT_NAME]="PROJECT_ID='$PROJECT_ID'; ACCOUNT_ID='$ACCOUNT_ID'; PROJECT_DISPLAY='$PROJECT_DISPLAY'"
            fi

            # Resolve milestone (cached)
            if [ -n "$MILESTONE_NAME" ]; then
                local CACHE_KEY="${PROJECT_NAME}::${MILESTONE_NAME}"
                if [ -n "${MILESTONE_CACHE[$CACHE_KEY]+x}" ]; then
                    eval "${MILESTONE_CACHE[$CACHE_KEY]}"
                else
                    resolve_milestone "$MILESTONE_NAME" "$PROJECT_ID"
                    if [ $? -ne 0 ]; then
                        echo -e "${RED}  ✗ Failed to resolve milestone: ${MILESTONE_NAME}${NC}"
                        FAILED=$((FAILED + 1))
                        continue
                    fi
                    MILESTONE_CACHE[$CACHE_KEY]="MILESTONE_ID='$MILESTONE_ID'; MILESTONE_DISPLAY='$MILESTONE_DISPLAY'"
                fi
            fi
        else
            resolve_account "$ACCOUNT_NAME"
            if [ $? -ne 0 ]; then
                echo -e "${RED}  ✗ Failed to resolve account: ${ACCOUNT_NAME}${NC}"
                FAILED=$((FAILED + 1))
                continue
            fi
        fi

        # Build payload
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
            echo -e "${RED}  ✗ Failed to create${NC}"
            echo "$RESULT" | jq
            FAILED=$((FAILED + 1))
            continue
        fi

        echo -e "${GREEN}  ✓ Ticket #${TICKET_ID} created${NC}"
        CREATED=$((CREATED + 1))

        # Link articles
        if [ -n "$ARTICLES" ]; then
            IFS=',' read -ra ARTICLE_LIST <<< "$ARTICLES"
            for RAW_ID in "${ARTICLE_LIST[@]}"; do
                RAW_ID=$(echo "$RAW_ID" | tr -d ' ')
                ARTICLE_UUID=$(resolve_article_identifier "$RAW_ID") || continue
                api_post "/tickets/${TICKET_ID}/articles/${ARTICLE_UUID}" '{}' > /dev/null
                echo -e "${GREEN}    Linked article: ${RAW_ID}${NC}"
            done
        fi

        # Link related tickets
        if [ -n "$RELATE_TICKETS" ]; then
            IFS=',' read -ra RELATE_LIST <<< "$RELATE_TICKETS"
            for RELATED_ID in "${RELATE_LIST[@]}"; do
                RELATED_ID=$(echo "$RELATED_ID" | tr -d ' ')
                RELATED_BARE="${RELATED_ID%%:*}"
                RELATION_TYPE="${RELATED_ID##*:}"
                [ "$RELATION_TYPE" = "$RELATED_BARE" ] && RELATION_TYPE="relates_to"
                REL_PAYLOAD=$(jq -n --arg rid "$RELATED_BARE" --arg rt "$RELATION_TYPE" '{"related_id": ($rid | tonumber), "relation_type": $rt, "visibility": "internal"}')
                REL_RESULT=$(api_post "/tickets/${TICKET_ID}/relations" "$REL_PAYLOAD")
                REL_STATUS=$(echo "$REL_RESULT" | jq -r '.status // "error"')
                if [ "$REL_STATUS" = "linked" ]; then
                    echo -e "${GREEN}    Linked ticket: #${RELATED_BARE} (${RELATION_TYPE})${NC}"
                elif [ "$REL_STATUS" = "already_exists" ]; then
                    echo -e "${YELLOW}    Already linked: #${RELATED_BARE}${NC}"
                else
                    echo -e "${RED}    Failed to link: #${RELATED_BARE}${NC}"
                fi
            done
        fi
    done

    # Summary
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Batch complete: ${CREATED} created, ${FAILED} failed${NC}"
    echo -e "${GREEN}========================================${NC}"

    [ "$FAILED" -gt 0 ] && exit 1
    exit 0
}
ticket_comment() {
    local TICKET_ID="$1"; shift
    local BODY="" STATUS="" VISIBILITY="internal" ENV="prod"

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) ticket_usage; exit 0 ;;
            -b|--body)       BODY="$2"; shift 2 ;;
            --status)        STATUS="$2"; shift 2 ;;
            --visibility)    VISIBILITY="$2"; shift 2 ;;
            -e|--env)        ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local BODY="" VISIBILITY="internal" ENV="prod"

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) ticket_usage; exit 0 ;;
            -b|--body)       BODY="$2"; shift 2 ;;
            --visibility)    VISIBILITY="$2"; shift 2 ;;
            -e|--env)        ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local ENV="prod" SHOW_CONTENT=false SHOW_RELATIONS=false

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) ticket_usage; exit 0 ;;
            -e|--env)       ENV="$2"; shift 2 ;;
            -c|--content)   SHOW_CONTENT=true; shift ;;
            -r|--relations) SHOW_RELATIONS=true; shift ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local ENV="prod"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) ticket_usage; exit 0 ;;
            -m|--milestone) MILESTONE="$2"; shift 2 ;;
            -p|--project)   PROJECT="$2"; shift 2 ;;
            --status)       STATUS="$2"; shift 2 ;;
            -e|--env)       ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local ENV="prod"

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) ticket_usage; exit 0 ;;
            -e|--env) ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local SUBJECT="" DESCRIPTION="" STATUS="" PRIORITY="" TICKET_TYPE="" MILESTONE_NAME="" ENV="prod"
    local ARTICLES=""

    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) ticket_usage; exit 0 ;;
            -s|--subject)     SUBJECT="$2"; shift 2 ;;
            -d|--description) DESCRIPTION="$2"; shift 2 ;;
            -f|--file)        DESC_FILE="$2"; shift 2 ;;
            --status)         STATUS="$2"; shift 2 ;;
            --priority)       PRIORITY="$2"; shift 2 ;;
            --type)           TICKET_TYPE="$2"; shift 2 ;;
            -m|--milestone)   MILESTONE_NAME="$2"; shift 2 ;;
            -e|--env)         ENV="$2"; shift 2 ;;
            --articles)       ARTICLES="$2"; shift 2 ;;
            --relate-tickets) RELATE_TICKETS="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
        esac
    done

    if [ -n "$DESC_FILE" ]; then
        [ ! -f "$DESC_FILE" ] && echo -e "${RED}✗ File not found: ${DESC_FILE}${NC}" && exit 1
        DESCRIPTION=$(cat "$DESC_FILE")
    fi
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
    # Link related tickets if --relate-tickets provided
    if [ -n "$RELATE_TICKETS" ]; then
        echo -e "${YELLOW}-> Linking related tickets...${NC}"
        IFS=',' read -ra RELATE_LIST <<< "$RELATE_TICKETS"
        for RELATED_ID in "${RELATE_LIST[@]}"; do
            RELATED_ID=$(echo "$RELATED_ID" | tr -d ' ')
            # Parse optional :type suffix (e.g. "374:blocks" → id=374, type=blocks)
            RELATED_BARE="${RELATED_ID%%:*}"
            RELATION_TYPE="${RELATED_ID##*:}"
            [ "$RELATION_TYPE" = "$RELATED_BARE" ] && RELATION_TYPE="relates_to"
            PAYLOAD=$(jq -n --arg rid "$RELATED_BARE" --arg rt "$RELATION_TYPE" '{"related_id": ($rid | tonumber), "relation_type": $rt, "visibility": "internal"}')
            RESULT=$(api_post "/tickets/${TICKET_ID}/relations" "$PAYLOAD")
            REL_STATUS=$(echo "$RESULT" | jq -r '.status // "error"')
            if [ "$REL_STATUS" = "linked" ]; then
                echo -e "${GREEN}  Linked ticket: #${RELATED_BARE} (${RELATION_TYPE})${NC}"
            elif [ "$REL_STATUS" = "already_exists" ]; then
                echo -e "${YELLOW}  Already linked: #${RELATED_BARE}${NC}"
            else
                echo -e "${RED}  Failed to link: #${RELATED_BARE}${NC}"
            fi
        done
    fi
}

# ─────────────────────────────────────────────
# TICKET RELATE / UNRELATE
# ─────────────────────────────────────────────
ticket_relate() {
    local TICKET_ID="$1"; shift
    local ARTICLES="" ENV="prod"
    [ -z "$TICKET_ID" ] && echo -e "${RED}Ticket ID is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) ticket_usage; exit 0 ;;
            --articles) ARTICLES="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local TICKETS="" RELATION_TYPE="relates_to" VISIBILITY="internal" ENV="prod"
    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) ticket_usage; exit 0 ;;
            --tickets)      TICKETS="$2"; shift 2 ;;
            --type)         RELATION_TYPE="$2"; shift 2 ;;
            --visibility)   VISIBILITY="$2"; shift 2 ;;
            -e|--env)       ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local RELATED_ID="" ENV="prod"
    [ -z "$TICKET_ID" ] && echo -e "${RED}✗ Ticket ID is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) ticket_usage; exit 0 ;;
            --ticket)   RELATED_ID="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local ARTICLE="" ENV="prod"
    [ -z "$TICKET_ID" ] && echo -e "${RED}Ticket ID is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) ticket_usage; exit 0 ;;
            --article)  ARTICLE="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local PROJECT_NAME="" NAME="" DUE_DATE="" BILLABLE="0" SEQUENCE="" ENV="prod"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) milestone_usage; exit 0 ;;
            -p|--project)   PROJECT_NAME="$2"; shift 2 ;;
            -n|--name)      NAME="$2"; shift 2 ;;
            --due-date)     DUE_DATE="$2"; shift 2 ;;
            --billable)     BILLABLE="$2"; shift 2 ;;
            --sequence)     SEQUENCE="$2"; shift 2 ;;
            --description)  DESCRIPTION="$2"; shift 2 ;;
            -e|--env)       ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local NAME="" STATUS="" DUE_DATE="" BILLABLE="" SEQUENCE="" ENV="prod"

    [ -z "$MILESTONE_ID" ] && echo -e "${RED}✗ Milestone ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) milestone_usage; exit 0 ;;
            -n|--name)      NAME="$2"; shift 2 ;;
            --status)       STATUS="$2"; shift 2 ;;
            --due-date)     DUE_DATE="$2"; shift 2 ;;
            --billable)     BILLABLE="$2"; shift 2 ;;
            --sequence)     SEQUENCE="$2"; shift 2 ;;
            --description)  DESCRIPTION="$2"; shift 2 ;;
            -e|--env)       ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local PROJECT_NAME="" ENV="prod" MS_STATUS="all" TICKET_STATUS="all" WITH_TICKETS=false FORMAT="text"
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) milestone_usage; exit 0 ;;
            -p|--project)          PROJECT_NAME="$2"; shift 2 ;;
            -e|--env)              ENV="$2"; shift 2 ;;
            --milestone-status)    MS_STATUS="$2"; shift 2 ;;
            --ticket-status)       TICKET_STATUS="$2"; shift 2 ;;
            --with-tickets)        WITH_TICKETS=true; shift ;;
            --format)              FORMAT="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
        esac
    done
    [ -z "$PROJECT_NAME" ] && echo -e "${RED}-p/--project is required${NC}" && exit 1
    resolve_env "$ENV"
    print_env_banner "sanctum.sh -- milestone list"
    ensure_auth
    resolve_project "$PROJECT_NAME" || exit 1
    RESULT=$(api_get "/projects/${PROJECT_ID}")

    # Build milestone status filter
    if [ "$MS_STATUS" = "open" ]; then
        MS_FILTER='select(.status == "pending" or .status == "active")'
    elif [ "$MS_STATUS" = "closed" ]; then
        MS_FILTER='select(.status == "completed")'
    else
        MS_FILTER='select(true)'
    fi

    # Build ticket status filter
    if [ "$TICKET_STATUS" = "open" ]; then
        T_FILTER='select(.status == "new" or .status == "open" or .status == "pending" or .status == "qa")'
    elif [ "$TICKET_STATUS" = "closed" ]; then
        T_FILTER='select(.status == "resolved")'
    else
        T_FILTER='select(true)'
    fi

    if [ "$FORMAT" = "json" ]; then
        echo "$RESULT" | jq "[.milestones | sort_by(.sequence) | .[] | $MS_FILTER | .tickets = (.tickets // [] | [ .[] | $T_FILTER ])]"
        return
    fi

    echo ""
    echo -e "${BLUE}Milestones: ${PROJECT_DISPLAY}${NC}"
    echo ""

    while IFS= read -r ms; do
        MS_NAME=$(echo "$ms" | jq -r '.name')
        MS_SEQ=$(echo "$ms" | jq -r '.sequence')
        MS_STAT=$(echo "$ms" | jq -r '.status')
        MS_ID=$(echo "$ms" | jq -r '.id')
        echo -e "  ${BLUE}[${MS_SEQ}]${NC} ${MS_NAME} -- ${MS_STAT} ${GRAY}(${MS_ID})${NC}"
        if [ "$WITH_TICKETS" = true ]; then
            echo "$ms" | jq -r '.tickets // [] | [ .[] | '"$T_FILTER"' ] | .[] | "      #\(.id) [\(.status)] \(.subject)"'
        fi
    done < <(echo "$RESULT" | jq -c ".milestones | sort_by(.sequence) | .[] | $MS_FILTER")

    echo ""
}
milestone_show() {
    local QUERY="$1"; shift
    local ENV="prod" TICKET_STATUS="all" WITH_TICKETS=true

    [ -z "$QUERY" ] && echo -e "${RED}✗ Milestone ID or name is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) milestone_usage; exit 0 ;;
            -e|--env)          ENV="$2"; shift 2 ;;
            --ticket-status)   TICKET_STATUS="$2"; shift 2 ;;
            --no-tickets)      WITH_TICKETS=false; shift ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
        esac
    done

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — milestone show"
    ensure_auth

    echo -e "${YELLOW}→ Looking up milestone: ${QUERY}...${NC}"
    PROJECTS=$(api_get "/projects")

    # Try UUID match first, then name match
    if [[ "$QUERY" =~ ^[0-9a-f-]{36}$ ]]; then
        MILESTONE=$(echo "$PROJECTS" | jq -c --arg q "$QUERY" '[.[].milestones[] | select(.id == $q)] | first // empty')
    else
        MILESTONE=$(echo "$PROJECTS" | jq -c --arg q "$QUERY" '[.[].milestones[] | select(.name == $q)] | first // empty')
    fi

    if [ -z "$MILESTONE" ] || [ "$MILESTONE" = "null" ] || [ "$MILESTONE" = "" ]; then
        echo -e "${RED}✗ Milestone not found: ${QUERY}${NC}"
        exit 1
    fi

    MS_NAME=$(echo "$MILESTONE" | jq -r '.name')
    MS_STATUS=$(echo "$MILESTONE" | jq -r '.status')
    MS_SEQ=$(echo "$MILESTONE" | jq -r '.sequence')
    MS_DUE=$(echo "$MILESTONE" | jq -r '.due_date // "—"')
    MS_BILLABLE=$(echo "$MILESTONE" | jq -r '.billable_amount // "0"')
    MS_DESC=$(echo "$MILESTONE" | jq -r '.description // ""')
    MS_ID=$(echo "$MILESTONE" | jq -r '.id')

    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  ${MS_NAME}${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "  Status:   ${MS_STATUS}"
    echo -e "  Sequence: ${MS_SEQ}"
    echo -e "  Due:      ${MS_DUE}"
    echo -e "  Billable: \$${MS_BILLABLE}"
    [ -n "$MS_DESC" ] && echo -e "  Desc:     ${MS_DESC}"
    echo -e "  ID:       ${GRAY}${MS_ID}${NC}"
    echo ""

    if [ "$WITH_TICKETS" = true ]; then
        # Build ticket status filter
        if [ "$TICKET_STATUS" = "open" ]; then
            T_FILTER='select(.status == "new" or .status == "open" or .status == "pending" or .status == "qa")'
        elif [ "$TICKET_STATUS" = "closed" ]; then
            T_FILTER='select(.status == "resolved")'
        else
            T_FILTER='select(true)'
        fi

        TICKETS=$(echo "$MILESTONE" | jq -c "[.tickets // [] | .[] | $T_FILTER]")
        TICKET_COUNT=$(echo "$TICKETS" | jq 'length')

        echo -e "${YELLOW}Tickets (${TICKET_COUNT}):${NC}"
        echo ""

        if [ "$TICKET_COUNT" = "0" ]; then
            echo -e "  ${GRAY}No tickets found.${NC}"
        else
            echo "$TICKETS" | jq -r '.[] | "  #\(.id) [\(.status)] [\(.priority)] \(.subject)"'
        fi
        echo ""
    fi
}

# ─────────────────────────────────────────────
# INVOICE DOMAIN
# ─────────────────────────────────────────────
invoice_create() {
    local ACCOUNT_NAME="" STATUS="sent" DESCRIPTION="QA Test Invoice" AMOUNT="100" ENV="prod"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) invoice_usage; exit 0 ;;
            -a|--account)     ACCOUNT_NAME="$2"; shift 2 ;;
            -s|--status)      STATUS="$2"; shift 2 ;;
            -d|--description) DESCRIPTION="$2"; shift 2 ;;
            --amount)         AMOUNT="$2"; shift 2 ;;
            -e|--env)         ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local STATUS="" DUE_DATE="" PAYMENT_TERMS="" ENV="prod"

    [ -z "$INVOICE_ID" ] && echo -e "${RED}✗ Invoice ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) invoice_usage; exit 0 ;;
            --status)         STATUS="$2"; shift 2 ;;
            --due-date)       DUE_DATE="$2"; shift 2 ;;
            --payment-terms)  PAYMENT_TERMS="$2"; shift 2 ;;
            -e|--env)         ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local TICKET_ID="" ENV="prod"

    [ -z "$INVOICE_ID" ] && echo -e "${RED}✗ Invoice ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) invoice_usage; exit 0 ;;
            --ticket) TICKET_ID="$2"; shift 2 ;;
            -e|--env)     ENV="$2"; shift 2 ;;
            -c|--content) SHOW_CONTENT=true; shift ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    local ENV="prod"

    [ -z "$INVOICE_ID" ] && echo -e "${RED}✗ Invoice ID is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) invoice_usage; exit 0 ;;
            -e|--env)     ENV="$2"; shift 2 ;;
            -c|--content) SHOW_CONTENT=true; shift ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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

# Translate human labels to API keys (Ticket #403)
map_category_to_key() {
    case "$1" in
        "Developer Documentation")     echo "developer-docs" ;;
        "System Documentation")        echo "system-docs" ;;
        "Standard Operating Procedure") echo "sop" ;;
        "Troubleshooting Guide")       echo "troubleshooting" ;;
        "General Knowledge")           echo "wiki" ;;
        "Template")                    echo "template" ;;
        *)                             echo "$1" ;; # Fallback
    esac
}

article_create() {
    local TITLE="" SLUG="" CATEGORY="" CONTENT_FILE="" ENV="prod"
    local RELATED=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) article_usage; exit 0 ;;
            -t|--title)    TITLE="$2"; shift 2 ;;
            --slug)        SLUG="$2"; shift 2 ;;
            --category)    CATEGORY="$2"; shift 2 ;;
            -f|--file)     CONTENT_FILE="$2"; shift 2 ;;
            -e|--env)      ENV="$2"; shift 2 ;;
            --related)     RELATED="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
        --arg category "$(map_category_to_key "$CATEGORY")" \
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
    local CONTENT_FILE="" TITLE="" ENV="prod" SECTION=""
    local RELATED=""

    [ -z "$ARTICLE_ID" ] && echo -e "${RED}✗ Article UUID or identifier is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) article_usage; exit 0 ;;
            -f|--file)  CONTENT_FILE="$2"; shift 2 ;;
            -t|--title) TITLE="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            --related)  RELATED="$2"; shift 2 ;;
            --section)    SECTION="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
        esac
    done

    local CONTENT=""
    if [ -n "$CONTENT_FILE" ]; then
        [ ! -f "$CONTENT_FILE" ] && echo -e "${RED}✗ File not found: ${CONTENT_FILE}${NC}" && exit 1
        CONTENT=$(cat "$CONTENT_FILE")
    elif [ -z "$SECTION" ]; then
        echo -e "${YELLOW}→ No -f/--file provided. Reading content from stdin (Ctrl+D to finish):${NC}"
        CONTENT=$(cat)
    else
        echo -e "${RED}✗ --section requires -f/--file${NC}" && exit 1
    fi

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — article update"
    ensure_auth
    # Resolve identifier (e.g. DOC-012) to UUID if needed
    if [[ ! "$ARTICLE_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
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

    # Section-level PATCH or full PUT
    if [ -n "$SECTION" ]; then
        echo -e "${YELLOW}→ Patching section: ${SECTION}...${NC}"
        PAYLOAD=$(jq -n --arg heading "$SECTION" --arg content "$CONTENT" \
            '{"heading": $heading, "content": $content}')
        RESULT=$(curl -s -X PATCH \
            -H "Authorization: Bearer $_SANCTUM_AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$PAYLOAD" \
            "${API_BASE}/articles/${ARTICLE_ID}/sections")
    else
        PAYLOAD=$(jq -n \
            --arg content "$CONTENT" \
            --arg title "$TITLE" \
            '{content: $content} | if $title != "" then .title = $title else . end')
        RESULT=$(api_put "/articles/${ARTICLE_ID}" "$PAYLOAD")
    fi

    UPDATED_ID=$(echo "$RESULT" | jq -r '.id // empty')

    if [ -z "$UPDATED_ID" ]; then
        echo -e "${RED}✗ Failed to update article${NC}"
        echo "$RESULT" | jq
        exit 1
    fi

    echo ""
    if [ -n "$SECTION" ]; then
        echo -e "${GREEN}✓ Section patched in ${ARTICLE_ID}: ${SECTION}${NC}"
    else
        echo -e "${GREEN}✓ Article updated: ${ARTICLE_ID}${NC}"
    fi
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
    local RELATED="" ENV="prod"
    [ -z "$ARTICLE_ID" ] && echo -e "${RED}✗ Article UUID or identifier is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) article_usage; exit 0 ;;
            --related)  RELATED="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
        esac
    done
    [ -z "$RELATED" ] && echo -e "${RED}✗ --related is required${NC}" && exit 1
    resolve_env "$ENV"
    print_env_banner "sanctum.sh — article relate"
    ensure_auth
    # Resolve source article
    if [[ ! "$ARTICLE_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
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
    local RELATED="" ENV="prod"
    [ -z "$ARTICLE_ID" ] && echo -e "${RED}✗ Article UUID or identifier is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) article_usage; exit 0 ;;
            --related)  RELATED="$2"; shift 2 ;;
            -e|--env)   ENV="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
        esac
    done
    [ -z "$RELATED" ] && echo -e "${RED}✗ --related is required${NC}" && exit 1
    resolve_env "$ENV"
    print_env_banner "sanctum.sh — article unrelate"
    ensure_auth
    if [[ ! "$ARTICLE_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
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

article_history() {
    local QUERY="$1"; shift
    local ENV="prod"
    local PAGE_SIZE=10
    [ -z "$QUERY" ] && echo -e "${RED}✗ Identifier or slug is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) article_usage; exit 0 ;;
            -e|--env)       ENV="$2"; shift 2 ;;
            -n|--page-size) PAGE_SIZE="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
        esac
    done
    resolve_env "$ENV"
    print_env_banner "sanctum.sh — article history"
    ensure_auth
    # Resolve identifier to UUID
    if [[ "$QUERY" =~ ^[A-Z]+-[0-9]+$ ]]; then
        echo -e "${YELLOW}→ Looking up by identifier: ${QUERY}...${NC}"
        ARTICLE_JSON=$(api_get "/articles" | jq --arg id "$QUERY" '.[] | select(.identifier == $id)')
    else
        echo -e "${YELLOW}→ Looking up by slug: ${QUERY}...${NC}"
        ARTICLE_JSON=$(api_get "/articles/${QUERY}")
    fi
    if [ -z "$ARTICLE_JSON" ] || [ "$ARTICLE_JSON" = "null" ]; then
        echo -e "${RED}✗ Article not found: ${QUERY}${NC}"
        exit 1
    fi
    local ARTICLE_ID=$(echo "$ARTICLE_JSON" | jq -r '.id')
    local ARTICLE_TITLE=$(echo "$ARTICLE_JSON" | jq -r '.title')
    echo -e "${GREEN}✓ ${ARTICLE_TITLE}${NC}"
    echo ""
    RESULT=$(api_get "/articles/${ARTICLE_ID}/history?page_size=${PAGE_SIZE}")
    TOTAL=$(echo "$RESULT" | jq '.total')
    echo -e "${YELLOW}History entries (${TOTAL} total, showing up to ${PAGE_SIZE}):${NC}"
    echo ""
    echo "$RESULT" | jq -r '.items[] | "  \(.version) — \(.snapshot_at) — \(.author_name // "System") — \(if .section_heading then "[" + .section_heading + "]" else "[Full article]" end) — \(if .change_comment then .change_comment else "" end)\n    ID: \(.id)"'
    echo ""
}

article_revert() {
    local QUERY="$1"; shift
    local ENV="prod"
    local HISTORY_ID=""
    local TO_VERSION=""
    local FIELDS=""
    local COMMENT=""
    [ -z "$QUERY" ] && echo -e "${RED}✗ Identifier or slug is required${NC}" && exit 1
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) article_usage; exit 0 ;;
            -e|--env)         ENV="$2"; shift 2 ;;
            --history-id)     HISTORY_ID="$2"; shift 2 ;;
            --to-version)     TO_VERSION="$2"; shift 2 ;;
            --fields)         FIELDS="$2"; shift 2 ;;
            --comment)        COMMENT="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
        esac
    done
    resolve_env "$ENV"
    print_env_banner "sanctum.sh — article revert"
    ensure_auth
    # Resolve identifier to UUID
    if [[ "$QUERY" =~ ^[A-Z]+-[0-9]+$ ]]; then
        echo -e "${YELLOW}→ Looking up by identifier: ${QUERY}...${NC}"
        ARTICLE_JSON=$(api_get "/articles" | jq --arg id "$QUERY" '.[] | select(.identifier == $id)')
    else
        echo -e "${YELLOW}→ Looking up by slug: ${QUERY}...${NC}"
        ARTICLE_JSON=$(api_get "/articles/${QUERY}")
    fi
    if [ -z "$ARTICLE_JSON" ] || [ "$ARTICLE_JSON" = "null" ]; then
        echo -e "${RED}✗ Article not found: ${QUERY}${NC}"
        exit 1
    fi
    local ARTICLE_ID=$(echo "$ARTICLE_JSON" | jq -r '.id')
    local ARTICLE_TITLE=$(echo "$ARTICLE_JSON" | jq -r '.title')
    local CURRENT_VERSION=$(echo "$ARTICLE_JSON" | jq -r '.version')
    # If --to-version given, resolve it to a history ID
    if [ -n "$TO_VERSION" ] && [ -z "$HISTORY_ID" ]; then
        echo -e "${YELLOW}→ Resolving version ${TO_VERSION}...${NC}"
        HISTORY_ID=$(api_get "/articles/${ARTICLE_ID}/history?page_size=200" | jq -r --arg v "$TO_VERSION" '.items[] | select(.version == $v) | .id' | head -1)
        if [ -z "$HISTORY_ID" ] || [ "$HISTORY_ID" = "null" ]; then
            echo -e "${RED}✗ No history entry found for version: ${TO_VERSION}${NC}"
            exit 1
        fi
    fi
    if [ -z "$HISTORY_ID" ]; then
        echo -e "${RED}✗ Either --history-id or --to-version is required${NC}"
        exit 1
    fi
    # Build JSON body
    local BODY="{}"
    if [ -n "$FIELDS" ]; then
        BODY=$(echo "$BODY" | jq --arg f "$FIELDS" '.fields = ($f | split(","))')
    fi
    if [ -n "$COMMENT" ]; then
        BODY=$(echo "$BODY" | jq --arg c "$COMMENT" '.change_comment = $c')
    fi
    echo ""
    echo -e "${BOLD}  Article:  ${ARTICLE_TITLE}${NC}"
    echo -e "  Current:  ${CURRENT_VERSION}"
    echo -e "  Revert to: ${HISTORY_ID}"
    [ -n "$FIELDS" ] && echo -e "  Fields:   ${FIELDS}"
    [ -n "$COMMENT" ] && echo -e "  Comment:  ${COMMENT}"
    echo ""
    confirm_prod
    RESULT=$(curl -s -X POST "${API_BASE}/articles/${ARTICLE_ID}/revert/${HISTORY_ID}" \
        -H "Authorization: Bearer ${_SANCTUM_AUTH_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$BODY")
    local NEW_VERSION=$(echo "$RESULT" | jq -r '.version')
    if [ -n "$NEW_VERSION" ] && [ "$NEW_VERSION" != "null" ]; then
        echo -e "${GREEN}✓ Article reverted${NC}"
        echo -e "  New version: ${NEW_VERSION}"
    else
        echo -e "${RED}✗ Revert failed${NC}"
        echo "$RESULT" | jq .
    fi
    echo ""
}
article_show() {
    local QUERY="$1"; shift
    local ENV="prod"
    local SHOW_CONTENT=false
    local SHOW_HEADINGS=false
    local SECTION=""

    [ -z "$QUERY" ] && echo -e "${RED}✗ Slug or identifier is required${NC}" && exit 1

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) article_usage; exit 0 ;;
            -e|--env)     ENV="$2"; shift 2 ;;
            -c|--content) SHOW_CONTENT=true; shift ;;
            --headings)     SHOW_HEADINGS=true; shift ;;
            --section)      SECTION="$2"; shift 2 ;;
            *) echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1 ;;
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
    if [ -n "$SECTION" ]; then
        # Extract section: from matching heading to next heading of equal/higher level
        local HEADING_LEVEL
        HEADING_LEVEL=$(echo "$SECTION" | awk '{match($0, /^#+/); print RLENGTH}')
        echo "$RESULT" | jq -r '.content' | awk -v heading="$SECTION" -v level="$HEADING_LEVEL" '
            BEGIN { found=0 }
            $0 == heading { found=1; print; next }
            found && /^#{1,}/ {
                match($0, /^#+/)
                if (RLENGTH <= level) exit
            }
            found { print }
        '
    elif [ "$SHOW_HEADINGS" = true ]; then
        echo "$RESULT" | jq -r '.content' | grep '^#\+ '
    elif [ "$SHOW_CONTENT" = true ]; then
        echo "$RESULT" | jq '{id, identifier, title, slug, category, version, author_id, created_at, updated_at, content}'
    else
        echo "$RESULT" | jq '{id, identifier, title, slug, category, version, author_id, created_at, updated_at}'
    fi
    echo ""
}
# ─────────────────────────────────────────────
# SEARCH DOMAIN
# ─────────────────────────────────────────────
search_query() {
    local QUERY="" TYPE="" LIMIT=5 ENV="prod"

    # First arg is the query (if not a flag)
    if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^- ]]; then
        QUERY="$1"; shift
    fi

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) search_usage; exit 0 ;;
            -t|--type)   TYPE="$2"; shift 2 ;;
            -l|--limit)  LIMIT="$2"; shift 2 ;;
            -e|--env)    ENV="$2"; shift 2 ;;
            *)
                # Append to query if not a flag
                if [[ ! "$1" =~ ^- ]]; then
                    QUERY="$QUERY $1"; shift
                else
                    echo -e "${RED}✗ Unknown option: $1${NC}"; echo "  Run with --help for valid options"; exit 1
                fi
                ;;
        esac
    done

    [ -z "$QUERY" ] && echo -e "${RED}✗ Search query is required${NC}" && exit 1

    resolve_env "$ENV"
    print_env_banner "sanctum.sh — search"
    ensure_auth

    # Prepend scope prefix if --type provided
    local PREFIX_MAP_TYPE=""
    case "$TYPE" in
        ticket)    PREFIX_MAP_TYPE="t:" ;;
        wiki)      PREFIX_MAP_TYPE="w:" ;;
        client)    PREFIX_MAP_TYPE="c:" ;;
        contact)   PREFIX_MAP_TYPE="u:" ;;
        asset)     PREFIX_MAP_TYPE="a:" ;;
        project)   PREFIX_MAP_TYPE="p:" ;;
        milestone) PREFIX_MAP_TYPE="m:" ;;
        product)   PREFIX_MAP_TYPE="i:" ;;
        "") ;;
        *) echo -e "${RED}✗ Invalid type: ${TYPE}. Valid: ticket, wiki, client, contact, asset, project, milestone, product${NC}"; exit 1 ;;
    esac

    local SEARCH_QUERY="$QUERY"
    if [ -n "$PREFIX_MAP_TYPE" ]; then
        SEARCH_QUERY="${PREFIX_MAP_TYPE} ${QUERY}"
    fi

    local ENCODED_QUERY
    ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$SEARCH_QUERY'))")

    echo -e "${YELLOW}→ Searching: ${SEARCH_QUERY}${NC}"
    echo ""

    RESULT=$(api_get "/search?q=${ENCODED_QUERY}&limit=${LIMIT}")
    COUNT=$(echo "$RESULT" | jq 'length')

    if [ "$COUNT" = "0" ]; then
        echo -e "  ${GRAY}No results found.${NC}"
        echo ""
        return
    fi

    echo -e "${GREEN}${COUNT} result(s):${NC}"
    echo ""
    printf "  ${GRAY}%-6s %-12s %-50s %s${NC}
" "SCORE" "TYPE" "TITLE" "SUBTITLE"
    printf "  ${GRAY}%-6s %-12s %-50s %s${NC}
" "─────" "──────────" "──────────────────────────────────────────────────" "────────────"

    echo "$RESULT" | jq -r '.[] | "\(.score // 0)|\(.type)|\(.title)|\(.subtitle // "-")|\(.link)"' | while IFS='|' read -r SCORE TYPE TITLE SUBTITLE LINK; do
        # Color by type
        case "$TYPE" in
            action)    COLOR="$GREEN" ;;
            ticket)    COLOR="$YELLOW" ;;
            wiki)      COLOR="[0;35m" ;;
            client)    COLOR="$BLUE" ;;
            asset)     COLOR="[0;36m" ;;
            contact)   COLOR="$GREEN" ;;
            project)   COLOR="$BLUE" ;;
            milestone) COLOR="$BLUE" ;;
            product)   COLOR="$GRAY" ;;
            *)         COLOR="$NC" ;;
        esac

        # Truncate title if too long
        if [ ${#TITLE} -gt 48 ]; then
            TITLE="${TITLE:0:45}..."
        fi

        printf "  %-6s ${COLOR}%-12s${NC} %-50s ${GRAY}%s${NC}
" "$SCORE" "$TYPE" "$TITLE" "$SUBTITLE"
    done
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
            create-batch) ticket_create_batch "$@" ;;
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
                echo "  Valid commands: create, create-batch, update, comment, resolve, list, show, delete, relate, unrelate, relate-tickets, unrelate-ticket"
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
            history)   article_history "$@" ;;
            revert)    article_revert "$@" ;;
            *)
                echo -e "${RED}✗ Unknown article command: ${COMMAND}${NC}"
                echo "  Valid commands: create, update, show, relate, unrelate, history, revert"
                exit 1
                ;;
        esac
        ;;
    context)
        shift 2 || true
        case "${COMMAND}" in
            -h|--help) context_usage ;;
            load)      context_load "$@" ;;
            *)
                echo -e "${RED}✗ Unknown context command: ${COMMAND}${NC}"
                echo "  Valid commands: load"
                exit 1
                ;;
        esac
        ;;
    search)
        shift
        case "${1:-}" in
            -h|--help) search_usage ;;
            *)         search_query "$@" ;;
        esac
        ;;
    *)
        echo -e "${RED}✗ Unknown domain: ${DOMAIN}${NC}"
        echo "  Valid domains: ticket, milestone, invoice, article, context, search"
        exit 1
        ;;
esac

}

main "$@" 2>&1 | tee /dev/tty | sed "s/\x1b\[[0-9;]*m//g" | xclip -selection clipboard -i
