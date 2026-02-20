# SESSION HANDOVER — 2026-02-20 (End of Session)

## 0. SESSION HANDOVER

---

## 1. WHAT WE ACCOMPLISHED

### Phase 65: The Polish — Sprint Complete

#### Ticket #218 — Bug: Add Asset in ClientDetail causes blank page ✅
- **Root cause:** `SearchableSelect` for Asset Type received `items` with key `title` but defaulted to `labelKey="name"`. `item["name"]` returned `undefined` → controlled input threw → React unmounted entire page tree.
- **Fixes (4 patches):**
  1. `AssetModal.jsx` — Added `labelKey="title"` to Asset Type `SearchableSelect` *(crash fix)*
  2. `AssetModal.jsx` — Added `api.get("/vendors")` fetch to `useEffect` — vendor dropdown was always empty
  3. `ClientDetail.jsx` — Added `specs: {}` to initial `assetForm` state
  4. `ClientDetail.jsx` — Added `specs: {}` to `onAdd` reset handler
- **Commit:** `c4ca476`

#### Ticket #219 — Bug: TicketDetail refresh does not reload comments ✅
- **Root cause:** `CommentStream` self-contained with `useEffect([resourceId, resourceType])` — no external trigger.
- **Fix:** Added `refreshKey` prop to `CommentStream` + dependency. `TicketDetail` increments `refreshKey` on refresh.
- **Commit:** `7282449`

#### Ticket #221 — Contextual buttons moved to sticky nav bar ✅
- Refresh, CopyMeta, ViewToggle moved from page title header into sticky top nav bar, left of notification bell.
- **Commit:** `023f1e2`

#### Ticket #222 — Sweep all modules — view toggles to sticky nav ✅
- **Architecture:** Generic `viewToggleOptions` prop on Layout — array of `{ value, icon }` pairs.
- **Modules updated:** `LibraryIndex`, `ProjectIndex`, `Tickets`, `TicketDetail`
- **Commit:** `418d188`

#### Ticket #223 — Bulk mark invoices paid ✅
- **Backend:** `POST /invoices/bulk-mark-paid` — atomic, admin-only. `BulkMarkPaidRequest` + `BulkMarkPaidRecipient` schemas. Response: `updated`, `emails_sent`, `emails_failed`. Receipts via `send_template` with `invoice_notice.html`.
- **Frontend:** Checkbox per row + select all, sticky green CTA bar, payment modal with method/date/send receipt toggle, per-invoice To field (prefilled from `billing_email`) + CC `SearchableSelect` with `allowCreate`, payment toast + email dispatch toast, `onRefresh` in sticky nav.
- **Commit:** `80a81d1`

#### DS-UX-002 — Subtitle & Breadcrumb Standard ✅ (DEFINED, NOT YET IMPLEMENTED)
- Standard defined and documented in handover (see Section 4).

---

## 2. CURRENT STATE

### Production
- **App:** https://app.digitalsanctum.com.au
- **API:** https://core.digitalsanctum.com.au/api
- **Swagger:** https://core.digitalsanctum.com.au/api/docs

### Git
- **Branch:** main
- **Last commit:** `80a81d1` — feat: bulk mark invoices paid with per-invoice recipients and email dispatch toasts (#223)
- **Clean working tree** ✅

### Database
- No migrations this session

---

## 3. KNOWN ISSUES / TECH DEBT

- **`api_test.sh`** — no `-e dev|prod` flag. Uses `API_BASE` env var. Inconsistent with other scripts.
- **`create_milestone.sh`** — no `--project-name` fuzzy resolution.
- **Template Library** — no `/templates/new` creation form yet.
- **Template sections** — no drag-to-reorder yet.
- **ToastContext** — exports `addToast` NOT `showToast`. Flag in every new component.
- **Comment API** — rejects JSON with special chars via shell. Use `cat > /tmp/file.json + curl -d @file` pattern.
- **Leftover patch files** (safe to delete):
  ```
  ~/Dev/DigitalSanctum/patch_models.py
  ~/Dev/DigitalSanctum/patch_main.py
  ~/Dev/DigitalSanctum/deploy_blueprint.sh
  ~/Dev/DigitalSanctum/seed_template_wix_11ty.py
  ~/Dev/DigitalSanctum/sanctum-web/sweep_toast.py
  ```

---

## 4. NEXT SPRINT — Phase 65 continued

### Item 1 — DS-UX-002: Subtitle & Breadcrumb Standard (DEFINED THIS SESSION)

#### Type A — Client-Anchored Pages (top-level)
**Format:** `{client} • {type} • {status}` — all lowercase, spaced bullet separator

| Page | Example |
|---|---|
| ClientDetail | `Digital Sanctum HQ • client • active` |
| InvoiceDetail | `Digital Sanctum HQ • invoice • sent` |
| DealDetail | `Massive Dynamic • deal • negotiation` |
| AuditDetail | `Digital Sanctum HQ • audit • draft` |
| AssetDetail | `Digital Sanctum HQ • workstation • active` |
| CampaignDetail | `Digital Sanctum HQ • campaign • draft` |

#### Type A — Deep/Relational Pages
**Breadcrumb:** `Client → Project → Milestone` (clickable links above title)
**Subtitle:** `{type} • {status} • {priority}`

| Page | Breadcrumb | Subtitle |
|---|---|---|
| TicketDetail | `Digital Sanctum HQ → Sanctum Core → Phase 65` | `task • open • high` |

#### Type B — System/Library Pages
**Format:** `{identifier} • {category} • {version} • {author}` (omit nulls)

| Page | Example |
|---|---|
| ArticleDetail | `DEV-060B • wiki • v1.0 • Peter Reginald` |
| TemplateDetail | `project template • web` |

**Implementation approach:**
1. Add `breadcrumb` prop to `Layout.jsx` — array of `{ label, path }` — renders above title as clickable trail
2. `TicketDetail` passes breadcrumb from `ticket.account_name → project.name → milestone.name`
3. Recon all Type A/B pages for current subtitle JSX before patching
4. Create ticket against Phase 65 milestone before starting

---

### Item 2 — Portal Project View + Backend ProjectDetail Review
- A) **C-Suite consultation** on current `ProjectDetail.jsx` UX
- B) **`PortalProjectDetail.jsx`** — milestone timeline, ticket status per milestone, progress indicators, no internal fields
- **Suggested:** Open with C-Suite consultation before writing code

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
- **Layout props:** `onRefresh`, `onCopyMeta`, `onViewToggle`, `viewToggleOptions`, `viewMode`, `breadcrumb` (new — not yet implemented)
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
   ~/Dev/DigitalSanctum/seed_template_wix_11ty.py \
   ~/Dev/DigitalSanctum/sanctum-web/sweep_toast.py

# Create ticket for DS-UX-002
./scripts/dev/create_ticket.sh \
  -e prod \
  -p "Sanctum Core" \
  -m "Phase 65" \
  --type feature \
  --priority normal \
  -s "Feature: DS-UX-002 — Standardise subtitle and breadcrumb across all detail pages"

# Recon — DS-UX-002 subtitle audit
grep -n "subtitle=" \
  ~/Dev/DigitalSanctum/sanctum-web/src/pages/ClientDetail.jsx \
  ~/Dev/DigitalSanctum/sanctum-web/src/pages/TicketDetail.jsx \
  ~/Dev/DigitalSanctum/sanctum-web/src/pages/InvoiceDetail.jsx \
  ~/Dev/DigitalSanctum/sanctum-web/src/pages/DealDetail.jsx \
  ~/Dev/DigitalSanctum/sanctum-web/src/pages/AssetDetail.jsx \
  ~/Dev/DigitalSanctum/sanctum-web/src/pages/AuditDetail.jsx \
  ~/Dev/DigitalSanctum/sanctum-web/src/pages/ArticleDetail.jsx \
  ~/Dev/DigitalSanctum/sanctum-web/src/pages/TemplateDetail.jsx

# Recon — Layout breadcrumb (not yet implemented)
grep -n "breadcrumb\|backPath" ~/Dev/DigitalSanctum/sanctum-web/src/components/Layout.jsx | head -10

# Recon — TicketDetail project/milestone data availability
grep -n "project\|milestone\|account_name" ~/Dev/DigitalSanctum/sanctum-web/src/pages/TicketDetail.jsx | head -20
```
