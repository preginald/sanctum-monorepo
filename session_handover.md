# Digital Sanctum — Session Handover
## Date: 2026-02-19 | Completed: Ticket #182 — Sovereign Architecture

---

## SESSION SUMMARY

Completed **Ticket #182** — refactored **16 pages** to the Intelligence Dossier design pattern (DS-UX-001). Every admin-facing page now delegates title, subtitle, badge, back navigation, and action buttons to the Layout component via props. Zero duplicate `<h1>` tags remain. Zero orphaned `ArrowLeft` imports.

### Pages Refactored

**Detail pages (8):** DealDetail, ProjectDetail, CampaignDetail, ClientDetail, TicketDetail, InvoiceDetail, AuditDetail, ArticleDetail

**Index/list pages (8):** Catalog, AuditIndex, Campaigns, LibraryIndex, AdminUserList, AdminAutomationList, Clients, Tickets

### Technical Pattern Established

```jsx
<Layout
  title={entity.name}
  subtitle={<>Type • <Link className="text-sanctum-gold">{parent}</Link></>}
  badge={{ label: entity.status, className: statusColor(entity.status) }}
  backPath="/parent-list"
  actions={<button>Action</button>}
>
```

Each detail page has a `statusColor` (or equivalent) helper mapping statuses to Tailwind classes like `'bg-green-500/20 text-green-400'`.

### Cleanup Done
- Removed orphaned `ProjectHeader.jsx` component
- All `.bak` files and `patch_*.sh` scripts cleaned before each commit

### Out of Scope (by design)
- Portal pages (`PortalTicketDetail`, `PortalProjectDetail`) use different layout system
- `TicketDetail.test.jsx` — test file, no Layout props

---

## NEXT SESSION PRIORITIES

The user selected the following for the next session:

### Priority 1: Bug Fixes 🐛

#### Bug #1 — Ticket premature save on contact link
- **Location:** `TicketDetail.jsx` or `TicketOverview.jsx`
- **Symptom:** When creating a new ticket in edit mode, linking a contact instantly saves the ticket
- **Likely cause:** `handleLinkContact` calls `api.put(/tickets/${id})` directly instead of updating local `formData.contact_ids` when `isEditing` is true
- **Fix approach:** Check `isEditing` state — if true, update `formData` only; if false (view mode quick-link), hit the API

#### Bug #2 — Tech roster shows portal clients
- **Location:** `TicketDetail.jsx` → `fetchTechs()` or `TicketOverview.jsx` assignee dropdown
- **Symptom:** Assignee dropdown shows all users including portal clients
- **Likely cause:** `fetchTechs` calls `/admin/users` without role filter
- **Fix approach:** Filter response by `role !== 'client'` or add backend param `?role=tech,admin`

### Priority 2: Quick Wins Batch ⚡

#### Global Refresh Button
- Add a refresh icon button to `Layout.jsx` sticky header
- Layout accepts an optional `onRefresh` prop (callback)
- Each page passes its fetch function: `<Layout onRefresh={fetchTicket}>`
- Button only renders when `onRefresh` is provided
- Subtle spin animation on click

#### Receipt Email on Payment
- **Location:** `InvoiceDetail.jsx` → `handleMarkPaid` flow
- After marking paid, show option to email receipt
- Use existing `showSendModal` pattern but pre-set subject to receipt format
- Default to billing contact, allow override via `SearchableSelect`
- Could be a checkbox in the payment modal: "Send receipt email after payment"

#### Asset Type SearchableSelect
- **Location:** Asset creation form (likely in `ClientDetail.jsx` or asset form component)
- Replace `<select>` dropdown with `SearchableSelect` for asset type field
- Source items from a constant or from existing asset types in the DB

#### Vendor Field Standardisation
- **Location:** Asset form
- Replace free-text vendor input with `SearchableSelect` that:
  - Fetches distinct vendor names from existing assets (`/assets/vendors` or client-side dedupe)
  - Allows typing a new value if no match (creatable mode)
  - This prevents "Synergy Wholesale" vs "Synnergy wholesale" drift

#### Copy Metadata Button
- Add a "Copy" icon button to Layout actions area (or a dedicated Layout prop)
- When clicked, copies structured metadata to clipboard:
  - Detail pages: entity name, ID, status, key fields
  - Index pages: page title, item count
- Format: plain text or markdown

### Priority 3: CLI Ticket Creator Script 🖥️

- Create a bash/Python script in the project's `scripts/` directory
- Usage: `./create_ticket.sh --project "Project Name" --milestone "Milestone Name" --subject "Ticket subject" --priority normal`
- Hits production API (uses existing auth token or service account)
- Steps: resolve project → resolve milestone → create ticket → assign to milestone
- Reference existing helper scripts in the repo for patterns

### Priority 4: Table UX Standardisation 📊

- Audit all index pages for row interaction patterns:
  - Some use row click → navigate
  - Some use text link in a column
  - Some use arrow button at end of row
- Establish standard: **Row click navigates to detail** (full row is clickable)
- Ensure consistent hover states (`hover:bg-white/5`)
- Consistent action column pattern (icon buttons, opacity-0 → group-hover:opacity-100)
- Pages to audit: Clients, Tickets, Catalog, AuditIndex, Campaigns, LibraryIndex, AdminUserList, AdminAutomationList

---

## STRATEGIC FEATURE: Project Templates (#16)

The user is most excited about this feature for near-term development.

### Vision
Reusable project blueprints with pre-defined milestones and ticket templates. When creating a new project, select a template and it auto-generates the full structure.

### Use Case Example
Client has a Wix website, wants an 11ty rebuild:
1. Select template: "Website Development — Static Site Migration"
2. Template creates project with milestones: Discovery → Design → Build → QA → Launch
3. Each milestone has pre-defined tickets: "Audit existing site", "Create wireframes", "Set up 11ty scaffold", etc.

### Data Model Sketch
```
ProjectTemplate
  - id, name, description, category
  - milestones: [{ name, position, tickets: [{ subject, description, ticket_type, priority }] }]
```

### Relates To
- **#15 Deal → Project pipeline** — templates define WHAT gets created; the pipeline defines WHEN (on deal close)
- **Audit onboarding flow** — closing an accession deal could auto-create a compliance project from template

---

## FULL BACKLOG (Prioritised)

### Bugs
| # | Item | Complexity |
|---|------|-----------|
| 1 | Ticket premature save on contact link | Quick fix |
| 2 | Tech roster shows portal clients in assignee | Quick fix |

### Quick Wins
| # | Item | Complexity |
|---|------|-----------|
| 3 | Global refresh button in Layout header | < 1hr |
| 4 | Receipt email option on mark-paid | 1-2hr |
| 5 | Asset type SearchableSelect | < 1hr |
| 6 | Vendor field autocomplete/standardisation | 1-2hr |
| 7 | Copy metadata button | 1-2hr |
| 8 | CLI ticket creator script | 1-2hr |
| 9 | KB table/list view with bulk edit | 2-3hr |

### Medium Features
| # | Item | Complexity |
|---|------|-----------|
| 10 | Table UX standardisation across all index pages | Half session |
| 11 | Domain expiry management + email templates | 1 session |
| 12 | Portal project view (attractive milestone display) | 1 session |
| 13 | Screenshot/screen capture with download options | 1 session |
| 14 | Financial planning dashboard from invoice data | 1-2 sessions |

### Strategic
| # | Item | Complexity |
|---|------|-----------|
| 15 | Deal → Project → Milestone → Ticket pipeline | 2-3 sessions |
| 16 | Project templates (reusable blueprints) | 2 sessions |
| 17 | Internal idea tracker (dogfooding Core's PM) | 0 code — use existing features |
| 18 | Screen capture integration | See #13 |

---

## ARCHITECTURAL NOTES

### Layout Component Props (Reference)
```jsx
// Current props supported:
title        // String or JSX — page title
subtitle     // String or JSX — descriptive line below title
badge        // { label, className } — status badge
backPath     // String path or -1 for browser back
actions      // JSX — action buttons in header

// Proposed new props (next session):
onRefresh    // Callback — shows refresh button when provided
```

### Design System Constants
- Gold accent: `text-sanctum-gold`, `bg-sanctum-gold`
- Status colors follow pattern: `bg-{color}-500/20 text-{color}-400`
- Cards: `bg-slate-900 border border-slate-700 rounded-xl`
- Table headers: `bg-black/20 text-xs uppercase text-slate-500 font-bold`

### Key Files Modified in This Session
```
sanctum-web/src/pages/DealDetail.jsx
sanctum-web/src/pages/ProjectDetail.jsx
sanctum-web/src/pages/CampaignDetail.jsx
sanctum-web/src/pages/ClientDetail.jsx
sanctum-web/src/pages/TicketDetail.jsx
sanctum-web/src/pages/InvoiceDetail.jsx
sanctum-web/src/pages/AuditDetail.jsx
sanctum-web/src/pages/ArticleDetail.jsx
sanctum-web/src/pages/Catalog.jsx
sanctum-web/src/pages/AuditIndex.jsx
sanctum-web/src/pages/Campaigns.jsx
sanctum-web/src/pages/LibraryIndex.jsx
sanctum-web/src/pages/AdminUserList.jsx
sanctum-web/src/pages/AdminAutomationList.jsx
sanctum-web/src/pages/Clients.jsx
sanctum-web/src/pages/Tickets.jsx
```

### Deleted
```
sanctum-web/src/components/projects/ProjectHeader.jsx  (orphaned)
```

---

## QUICKSTART FOR NEXT SESSION

```bash
cd ~/Dev/DigitalSanctum/sanctum-web

# Verify current state
grep -rn "actions=" src/pages/*.jsx | wc -l  # Should be 16+

# Start dev server
npm run dev

# Bug #1 — find the premature save
grep -n "handleLinkContact\|contact_ids" src/pages/TicketDetail.jsx src/components/tickets/TicketOverview.jsx

# Bug #2 — find the unfiltered tech list
grep -n "fetchTechs\|admin/users" src/pages/TicketDetail.jsx
```
