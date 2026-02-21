# SESSION HANDOVER — 2026-02-21 (End of Session)

## 0. SESSION HANDOVER

---

## 1. WHAT WE ACCOMPLISHED

### Phase 65: The Polish — Sprint Continued

#### Ticket #224 — Feature: DS-UX-002/003 — Standardise subtitle and breadcrumb across all detail pages ✅

**DS-UX-002 — Breadcrumb Standard**
- Added `breadcrumb` prop to `Layout.jsx` — array of `{ label, path }`, renders above title as clickable trail
- `backPath` still supported for simple back-nav (no regression)
- Swept all Detail pages with breadcrumb trail per client-anchor pattern

**DS-UX-003 — Badge Row Standard**
- Created `src/lib/statusStyles.js` — centralised colour maps for all status/type/priority values
  - Full class strings (no template literals) — required for Tailwind CSS purge compatibility
  - Maps: priority, ticketStatus, ticketType, invoiceStatus, dealStage, assetStatus, clientStatus, auditStatus, projectStatus, campaignStatus
- Created `src/components/ui/StatusBadge.jsx` — shared component, accepts `value` + `map` props
- Added `badges` array prop to `Layout.jsx` — fixed row below title, backward compat with legacy `badge` maintained

**Three-line header pattern (applied to all detail pages):**
```
{breadcrumb trail}     ← clickable nav above title
{title}                ← bold h2
[badge] [badge]        ← fixed colour-coded pill row
```

**Pages patched:**
- `TicketDetail.jsx` — breadcrumb (account → project → milestone) + three badges (type, status, priority). Milestone context bar removed, moved into TicketOverview card.
- `ClientDetail.jsx` — breadcrumb (Clients) + status badge
- `InvoiceDetail.jsx` — breadcrumb (account → Invoices) + status badge
- `DealDetail.jsx` — breadcrumb (account → Deals) + stage badge
- `AssetDetail.jsx` — breadcrumb (account → Assets) + status badge
- `AuditDetail.jsx` — breadcrumb (account → Audits) + status badge
- `ProjectDetail.jsx` — breadcrumb (account → Projects) + status badge
- `CampaignDetail.jsx` — breadcrumb (Campaigns) + status badge (no client anchor — campaigns are multi-account)
- `ArticleDetail.jsx` — legacy badge kept (category), subtitle kept (identifier • category • version • author)
- `TemplateDetail.jsx` — legacy badge kept (active/inactive), subtitle kept (type • category)

**TicketOverview.jsx refactor:**
- Status & Priority grid removed from read view — redundant with header badges
- Milestone section added to card — pill display + SearchableSelect, mirrors Agent pattern
- Agent section top border removed

**Backend patches:**
- `app/routers/sentinel.py` — `account_name` added to audit detail response
- `app/routers/comments.py` — `DELETE /comments/{comment_id}` endpoint added (author or admin)

**Commits:**
- `75c38e8` — feat: DS-UX-002/003 — breadcrumb, badge row, milestone in ticket card (#224)
- `300a2d2` — chore: remove stale sweep_toast.py patch file
- `f0cebab` — feat: DS-UX-002/003 — breadcrumb + badge sweep across all detail pages (#224)

---

## 2. CURRENT STATE

### Production
- **App:** https://app.digitalsanctum.com.au
- **API:** https://core.digitalsanctum.com.au/api
- **Swagger:** https://core.digitalsanctum.com.au/api/docs

### Git
- **Branch:** main
- **Last commit:** `f0cebab` — feat: DS-UX-002/003 — breadcrumb + badge sweep across all detail pages (#224)
- **Clean working tree** ✅

### Database
- No migrations this session

---

## 3. KNOWN ISSUES / TECH DEBT

- **Comment response schema** — `ticket_id` not echoed back in POST /comments response. Minor read-back gap, low priority.
- **`api_test.sh`** — no `-e dev|prod` flag. Uses `API_BASE` env var. Inconsistent with other scripts.
- **`create_milestone.sh`** — no `--project-name` fuzzy resolution.
- **Template Library** — no `/templates/new` creation form yet.
- **Template sections** — no drag-to-reorder yet.
- **ToastContext** — exports `addToast` NOT `showToast`. Flag in every new component.
- **Comment API** — rejects JSON with special chars via shell. Use `cat > /tmp/file.json + curl -d @file` pattern.
- **CampaignDetail** — no client anchor in breadcrumb. Campaigns are multi-account by design.
- **`/invoices` list view** — doesn't exist yet (linked from InvoiceDetail breadcrumb).
- **`/assets` list view** — doesn't exist yet (linked from AssetDetail breadcrumb).
- **`/audits` list view** — doesn't exist yet (linked from AuditDetail breadcrumb).
- **Leftover patch files** (safe to delete):
  ```
  ~/Dev/DigitalSanctum/patch_models.py
  ~/Dev/DigitalSanctum/patch_main.py
  ~/Dev/DigitalSanctum/deploy_blueprint.sh
  ~/Dev/DigitalSanctum/seed_template_wix_11ty.py
  ```

---

## 4. NEXT SPRINT — Phase 65 continued

### Item 1 — Portal Project View + Backend ProjectDetail Review
- A) **C-Suite consultation** on current `ProjectDetail.jsx` UX
- B) **`PortalProjectDetail.jsx`** — milestone timeline, ticket status per milestone, progress indicators, no internal fields
- **Suggested:** Open with C-Suite consultation before writing code

### Item 2 — List Views for Invoices, Assets, Audits
- `/invoices` — Unpaid invoices view exists (`UnpaidInvoices.jsx`) but no full invoice list
- `/assets` — `AssetLifecycle.jsx` exists but check if it serves as the list view
- `/audits` — `AuditIndex.jsx` exists — confirm route is `/audits`
- Breadcrumb links from detail pages will 404 until these routes are confirmed/created

---

## 5. IMPORTANT NOTES FOR NEXT SESSION

- **Auth:** `export SANCTUM_API_TOKEN=sntm_...` — mandatory, no TOTP
- **Toast hook:** `addToast` NOT `showToast`
- **Ticket workflow:** Post resolution comment BEFORE marking resolved
- **Delivery:** Surgical recon (grep/sed → cat -A → Python for multi-line JSX)
- **Migration:** Always `alembic revision --autogenerate`
- **API prefix:** `https://core.digitalsanctum.com.au/api`
- **Comment posting:** Use `cat > /tmp/file.json + curl -d @file` to avoid JSON encoding issues
- **Project ID (Sanctum Core v1.x):** `335650e8-1a85-4263-9a25-4cf2ca55fb79`
- **Phase 65 milestone ID:** `690652ef-4602-4a82-ae4c-dfa6dfa052a3`
- **Blueprint milestone ID:** `3da65428-7634-4068-89e6-536e5d37fcfe`
- **Account ID (DS HQ):** `dbc2c7b9-d8c2-493f6ed-527f7d191068`
- **UI pattern:** Intelligence Dossier — reference `AssetDetail.jsx`
- **Three-line header standard (DS-UX-002/003):** breadcrumb → title → badges. Reference: `TicketDetail.jsx`
- **StatusBadge:** `<StatusBadge value={x} map="priority" />` — maps in `src/lib/statusStyles.js`
- **Tailwind purge:** All class strings in statusStyles.js MUST be complete unbroken strings — no template literals
- **Layout props:** `onRefresh`, `onCopyMeta`, `onViewToggle`, `viewToggleOptions`, `viewMode`, `breadcrumb`, `badges`
- **Legacy `badge` prop:** Still supported in Layout for ArticleDetail and TemplateDetail
- **viewToggleOptions format:** `[{ value: 'grid', icon: <LayoutGrid size={14} /> }]`

---

## 6. COMMANDS FOR NEXT SESSION

```bash
# Start local dev
cd ~/Dev/DigitalSanctum/sanctum-core && source ../venv/bin/activate && uvicorn app.main:app --reload
cd ~/Dev/DigitalSanctum/sanctum-web && npm run dev

# Auth
export SANCTUM_API_TOKEN=sntm_your_token

# Clean up leftover patch files
rm ~/Dev/DigitalSanctum/patch_models.py \
   ~/Dev/DigitalSanctum/patch_main.py \
   ~/Dev/DigitalSanctum/deploy_blueprint.sh \
   ~/Dev/DigitalSanctum/seed_template_wix_11ty.py

# Verify breadcrumb routes exist
grep -rn "path.*invoices\|path.*assets\|path.*audits" ~/Dev/DigitalSanctum/sanctum-web/src/App.jsx

# Recon ProjectDetail for C-Suite consult
wc -l ~/Dev/DigitalSanctum/sanctum-web/src/pages/ProjectDetail.jsx
sed -n '1,50p' ~/Dev/DigitalSanctum/sanctum-web/src/pages/ProjectDetail.jsx

# Create ticket for Portal Project View
./scripts/dev/create_ticket.sh \
  -e prod \
  -p "Sanctum Core" \
  -m "Phase 65" \
  --type feature \
  --priority normal \
  -s "Feature: PortalProjectDetail — milestone timeline and ticket status view"
```
