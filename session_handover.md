# SESSION HANDOVER: Phase 62 — Wiki Client Delivery + Asset Lifecycle + Portal Infrastructure

**Date:** 2026-02-18
**Session Duration:** Tickets #180, #181, plus portal infrastructure and design standards
**Next Sprint:** Intelligence Dossier — Site-wide Layout Refactoring

## WHAT WE ACCOMPLISHED

### Ticket #180 — Wiki Client Delivery ✅
- ✅ Feature A: Portal ticket sidebar shows linked articles
- ✅ Feature B: PDF export with WeasyPrint (branded header, `@page :first` full-bleed, 10pt header text)
- ✅ Feature C: Email article to client with PDF attachment (`POST /articles/{id}/email`)
- ✅ Portal article viewer (`/portal/wiki/:slug`) using SanctumMarkdown component
- ✅ Portal Knowledge Base page (`/portal/wiki`) with search across all client-linked articles
- ✅ Backend endpoint `GET /portal/articles` (aggregates articles linked to account's tickets)
- ✅ Backend endpoint `GET /portal/articles/{slug}` (access-controlled by ticket linkage)

### Ticket #181 — Asset Lifecycle MVP ✅
- ✅ Expiring assets dashboard (`GET /assets/lifecycle/expiring?days=90`)
- ✅ Auto-status updates: active → expiring → expired
- ✅ 30/60/90/180 day window filter with non-jarring refresh
- ✅ One-click renewal ticket creation (`POST /assets/{asset_id}/renewal-ticket`)
- ✅ Duplicate prevention (checks for existing open renewal tickets)
- ✅ Asset detail page — canonical Intelligence Dossier implementation
- ✅ Clickable asset names from Client Detail's AssetList component
- ✅ Navigation link in Layout sidebar

### Portal Infrastructure ✅
- ✅ `usePortalNav` hook — preserves `?impersonate=` across all portal navigation
- ✅ Admin impersonation fixed across ALL portal pages (PortalDashboard, PortalTicketDetail, PortalProjectDetail, PortalAssets, PortalAssessments, PortalAuditReport, PortalSecurityReport, PortalQuestionnaire)
- ✅ `verify_ticket_access` — admin bypass for impersonated views
- ✅ Backend `impersonate` param added to: tickets, ticket detail, ticket comments, ticket invoices, assets, projects, articles

### Layout Enhancement ✅
- ✅ Layout component accepts: `title`, `subtitle`, `badge`, `backPath`, `actions`
- ✅ AssetDetail refactored as reference implementation (no in-page header)
- ✅ `backPath` supports `-1` (browser back) or explicit path string
- ✅ Subtitle supports JSX (clickable parent entity links in gold)

### Documentation ✅
- ✅ DS-UX-001 Intelligence Dossier v1.1 — full UI design standard
- ✅ SOP-099 v2.18 — Surgical Reconnaissance delivery doctrine, Intelligence Dossier reference, self-contained Super Prompt

## CURRENT STATE

### Production URLs
- Core: https://core.digitalsanctum.com.au
- Portal: https://core.digitalsanctum.com.au/portal
- API: https://core.digitalsanctum.com.au/api

### Database State
- Assets have `expires_at`, `status` (active/expiring/expired/decommissioned), `specs` (JSONB)
- `ticket_articles` association table links articles to tickets
- `ticket_assets` association table links assets to tickets

### Git Status
- Branch: main
- All changes committed and pushed
- Last commits:
  - `#180 Portal impersonation sweep`
  - `#180 Portal article delivery`
  - `#181 Asset Detail page`
  - `#181 Asset Lifecycle UX`
  - `#181 Asset Lifecycle MVP`

### WeasyPrint Dependencies (Production)
- Required: `libpango-1.0-0`, `libpangoft2-1.0-0`, `libpangocairo-1.0-0`, `libgdk-pixbuf2.0-0`, `libffi-dev`, `libcairo2`
- Install: `apt-get install -y [packages] && systemctl restart sanctum-api`

## KNOWN ISSUES / TECH DEBT

- PortalAssessments and PortalAuditReport now pass `impersonate` to `/portal/dashboard` but the backend `/portal/assessments/request` endpoint may need `impersonate` support if admin tries to request an assessment while impersonating
- Portal invoice download (`/portal/invoices/{id}/download`) — impersonate param added to frontend but backend endpoint not verified
- Article PDF download from portal (`/articles/{id}/pdf`) uses admin endpoint — may need a portal-scoped PDF endpoint for proper access control
- Layout `backPath={-1}` uses browser back — could be fragile if user navigates directly to a detail URL

## NEXT SPRINT: Intelligence Dossier — Site-wide Layout Refactoring

### Context
The Layout component now supports enhanced header props (`title`, `subtitle`, `badge`, `backPath`, `actions`). AssetDetail is the canonical reference. Every other detail view still has duplicate in-page headers and doesn't use these props.

### Likely Requirements
1. Refactor ClientDetail to use Layout props (remove in-page header, add clickable breadcrumbs)
2. Refactor TicketDetail to use Layout props (status badge, client link in subtitle)
3. Refactor other detail views: ProjectDetail, DealDetail, InvoiceDetail, ArticleDetail
4. Audit for duplicate data display (e.g., "type" appearing in both header and properties card)
5. Ensure all entity references are clickable (graph navigation principle)

### Suggested Approach
1. **Recon:** `grep -rn "Layout title=" src/pages/*Detail*.jsx` to map all detail pages
2. **Pattern:** For each page: remove in-page header block, pass title/subtitle/badge/backPath/actions to Layout
3. **Verify:** Each page should show entity name + status once (in Layout header), not twice
4. **Reference:** Follow AssetDetail.jsx and DS-UX-001 checklist

## HANDOVER CHECKLIST
✅ Both tickets (#180, #181) deployed to production
✅ DS-UX-001 Intelligence Dossier documented
✅ SOP-099 updated to v2.18 with Surgical Reconnaissance
✅ Super Prompt is self-contained (no broken cross-references)
✅ All portal pages support admin impersonation
✅ usePortalNav hook created and deployed

## IMPORTANT NOTES FOR NEXT AI SESSION

### Patterns Established
- **Surgical Reconnaissance** is the default delivery method — grep/sed first, find/replace pairs for changes, sweep scripts for systemic bugs
- **Intelligence Dossier** (DS-UX-001) is the standard for all detail views
- **usePortalNav** hook must be used for all portal navigation (preserves impersonate param)
- **Layout props** — all detail pages should use title/subtitle/badge/backPath/actions instead of building their own headers
- **SanctumMarkdown** component for all markdown rendering (not ReactMarkdown directly)
- Gold (`text-sanctum-gold`) reserved for navigation links; purple for automation actions

### User Preferences
- Prefers consultative approach — propose before coding
- Likes one-step-at-a-time delivery (not walls of code)
- Values non-jarring UX (skeleton on first load, spinner on refresh)
- Australian English throughout

### Gotchas
- Layout route ordering matters: `/lifecycle/expiring` must come before `/{asset_id}` to avoid UUID parse errors
- Portal pages need BOTH frontend (usePortalNav + API params) AND backend (impersonate param) changes
- WeasyPrint needs system-level packages on production server

## COMMANDS FOR NEXT SESSION

```bash
# Start dev environment
cd ~/Dev/DigitalSanctum
cd sanctum-core && source venv/bin/activate && uvicorn app.main:app --reload --port 8000 &
cd ../sanctum-web && npm run dev &

# Deploy to production
cd ~/Dev/DigitalSanctum && git add . && git commit -m "message" && git push origin main

# Check portal impersonation
# Use: /portal?impersonate=ACCOUNT_UUID

# Reference files for dossier refactoring
# Layout: sanctum-web/src/components/Layout.jsx
# Reference: sanctum-web/src/pages/AssetDetail.jsx
# Standard: DS-UX-001 Intelligence Dossier
```
