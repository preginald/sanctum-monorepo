#!/bin/bash
# Update Ticket #182 — Sovereign Architecture
# Run from: ~/Dev/DigitalSanctum

set -e

TICKET_ID=182
ENV="-e prod"

echo "=== Updating Ticket #182 ==="
echo ""

# 1. UPDATE DESCRIPTION (Refactor template per DOC-015)
echo "📝 [1/3] Updating description..."
./scripts/dev/sanctum.sh ticket update $TICKET_ID $ENV \
  -d "## Objective

Refactor all admin-facing detail and index pages to the Intelligence Dossier design pattern (DS-UX-001), eliminating duplicate in-page headers by promoting title, subtitle, badge, back navigation, and action buttons into Layout component props.

## Motivation

Every detail page contained its own hand-rolled header block with an ArrowLeft back button, h1 title, status badges, and action buttons. This created 16 independent header implementations that diverged in styling, spacing, and interaction patterns. The Layout component already supported title, subtitle, badge, backPath, and actions props (established by AssetDetail.jsx as the canonical reference), but most pages only passed a generic string title.

## Approach

1. Recon each page to map header elements (title, subtitle, badges, actions)
2. Add statusColor helper function for semantic badge colouring
3. Replace generic Layout title with full props (title, subtitle, badge, backPath, actions)
4. Remove duplicate in-page header block (ArrowLeft, h1, inline badges, action buttons)
5. Handle special cases: ClientDetail inline edit form, TicketDetail milestone context bar, ArticleDetail content/history tabs
6. Verify via grep: Layout props present, no duplicate h1 tags, no orphaned ArrowLeft imports
7. Repeat for index/list pages (promote floating action buttons to Layout actions prop)

## Out of Scope

- Portal pages (PortalTicketDetail, PortalProjectDetail) — different layout system
- Layout component internals — no changes to Layout.jsx itself
- Functional behaviour — pure presentation refactor, zero logic changes

## Files
- sanctum-web/src/pages/DealDetail.jsx
- sanctum-web/src/pages/ProjectDetail.jsx
- sanctum-web/src/pages/CampaignDetail.jsx
- sanctum-web/src/pages/ClientDetail.jsx
- sanctum-web/src/pages/TicketDetail.jsx
- sanctum-web/src/pages/InvoiceDetail.jsx
- sanctum-web/src/pages/AuditDetail.jsx
- sanctum-web/src/pages/ArticleDetail.jsx
- sanctum-web/src/pages/Catalog.jsx
- sanctum-web/src/pages/AuditIndex.jsx
- sanctum-web/src/pages/Campaigns.jsx
- sanctum-web/src/pages/LibraryIndex.jsx
- sanctum-web/src/pages/AdminUserList.jsx
- sanctum-web/src/pages/AdminAutomationList.jsx
- sanctum-web/src/pages/Clients.jsx
- sanctum-web/src/pages/Tickets.jsx

## Reference
- DS-UX-001: Intelligence Dossier Design Pattern
- AssetDetail.jsx: Canonical reference implementation"

echo "  ✅ Description updated"
echo ""

# 2. ADD PROPOSED SOLUTION COMMENT
echo "💬 [2/3] Adding solution comment..."
./scripts/dev/sanctum.sh ticket comment $TICKET_ID $ENV \
  -b "## Proposed Solution

**Surgical patch script approach** — one Python-based bash script per page (later batched for index pages). Each script:

1. Backs up the original file (.bak)
2. Removes ArrowLeft from lucide-react imports
3. Injects a statusColor helper function with semantic colour mapping
4. Replaces the generic \`<Layout title=\"...\">\` + in-page header block with full Layout props (title, subtitle, badge, backPath, actions)
5. Runs verification greps to confirm: Layout props present, no duplicate h1 tags, helper function exists

**Special cases handled:**
- **ClientDetail** — inline edit form moved to conditional gold-bordered card below Layout header; Layout title updates reactively as user types
- **TicketDetail** — milestone SearchableSelect preserved as interactive context bar below header (too complex for subtitle)
- **ArticleDetail** — content/history tabs preserved below header as navigation bar
- **InvoiceDetail** — backPath set to \`/clients/\${invoice.account_id}\` (contextual parent, not generic list)
- **AuditDetail** — title is contextual: 'Compliance Audit' (finalized), 'Draft Assessment' (existing), 'New Assessment' (new)
- **AdminAutomationList** — New Rule button conditionally rendered only on rules tab

**Delivery:** 3 commits across the session, patch scripts and .bak files cleaned before each commit."

echo "  ✅ Solution comment added"
echo ""

# 3. RESOLVE TICKET
echo "🏁 [3/3] Resolving ticket..."
./scripts/dev/sanctum.sh ticket resolve $TICKET_ID $ENV \
  -b "## Resolution

Refactored **16 pages** to the Intelligence Dossier pattern (DS-UX-001). All admin-facing pages now delegate header content to Layout component props.

**Detail pages (8):** DealDetail, ProjectDetail, CampaignDetail, ClientDetail, TicketDetail, InvoiceDetail, AuditDetail, ArticleDetail — each with statusColor helper, semantic badge, contextual subtitle with clickable parent links, and conditional action buttons.

**Index pages (8):** Catalog, AuditIndex, Campaigns, LibraryIndex, AdminUserList, AdminAutomationList, Clients, Tickets — action buttons promoted from floating divs to Layout actions prop, subtitles added.

**Cleanup:** Removed orphaned ProjectHeader.jsx component (no longer imported by any page).

**Verification sweep results:**
- 0 duplicate \`<h1>\` tags in admin pages
- 0 ArrowLeft imports in admin pages
- 16 pages with \`actions=\` prop
- 16 pages with \`backPath=\` or contextual subtitle
- Portal pages confirmed out of scope (different layout system)

All changes committed and pushed to main across 3 commits."

echo "  ✅ Ticket resolved"
echo ""
echo "🎯 Ticket #182 fully documented and closed."
