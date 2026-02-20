# SESSION HANDOVER — 2026-02-20 (End of Session)

## 0. SESSION HANDOVER

---

## 1. WHAT WE ACCOMPLISHED

### Ticket #189 — Phase 64: The Blueprint ✅

#### Architecture Decision
Rejected a project-only `ProjectTemplate` model. Built a **Universal Template Engine** — a single generic foundation supporting any entity type (`project`, `ticket`, `deal`, `campaign`, and future types).

#### Backend
- ✅ 4 new models appended to `app/models.py`:
  - `Template` — top-level with `template_type`, `category`, `tags`, `icon`, `times_applied`, `source_template_id` (clone lineage), `created_by_id`
  - `TemplateSection` — ordered milestone/phase stubs
  - `TemplateItem` — ticket stubs with `item_type`, `priority`, `config` JSONB
  - `TemplateApplication` — audit log of every apply action
- ✅ `app/schemas/templates.py` — full Pydantic schema suite
- ✅ `app/routers/templates.py` — CRUD, clone, import/export JSON, apply (atomic project scaffold), section/item inline edit, application history
- ✅ Alembic migration: `ebecc463a0c2_add_universal_template_engine` — applied to prod
- ✅ Seeder: `sanctum-core/seeders/seed_template_wix_11ty.py`
- ✅ Seed: *Website Rebuild — Existing Site → 11ty* (`33bf15f7-4b2a-4a9d-9d0d-a0649bd3a4e3`) — 6 milestones, 26 tickets

#### API Endpoints Live
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/templates` | Filterable library |
| POST | `/templates` | Create |
| POST | `/templates/import` | JSON import |
| GET | `/templates/{id}/export` | Portable JSON export |
| POST | `/templates/{id}/clone` | Deep clone with lineage |
| POST | `/templates/{id}/apply` | Atomically scaffold project + milestones + tickets |
| GET | `/templates/{id}/applications` | Usage history |
| POST/PUT/DELETE | `/templates/{id}/sections` | Inline section management |
| POST/PUT/DELETE | `/templates/sections/{id}/items` | Inline item management |

#### Frontend
- ✅ `TemplateLibrary.jsx` — card grid, type/category/search filters, usage badges, clone modal, JSON import modal, stats bar
- ✅ `TemplateDetail.jsx` — Intelligence Dossier, inline section/item editing, apply modal, export JSON, clone, application history sidebar, activate/deactivate
- ✅ `Layout.jsx` — `Layers` icon added, Templates nav item after Projects
- ✅ `App.jsx` — `/templates` and `/templates/:id` routes registered

### Ticket #191 — Bug: Template import silent failure ✅
- Root cause: `showToast` called but `ToastContext` exports `addToast`
- Fix: Swept 23 occurrences across `TemplateLibrary.jsx` and `TemplateDetail.jsx`
- Commit: `8724b4c`

---

## 2. CURRENT STATE

### Production
- **App:** https://app.digitalsanctum.com.au
- **API:** https://core.digitalsanctum.com.au/api
- **Swagger:** https://core.digitalsanctum.com.au/api/docs

### Git
- **Branch:** main
- **Last commit:** `8724b4c` — fix: replace showToast with addToast
- **Clean working tree** ✅

### Database
- **4 new tables:** `templates`, `template_sections`, `template_items`, `template_applications`
- **Live seed:** Website Rebuild — Wix → 11ty (`33bf15f7`)
- **Blueprint milestone:** `3da65428-7634-4068-89e6-536e5d37fcfe`

### Active Tickets
- **#189** — The Blueprint — COMPLETE ✅
- **#191** — showToast bug — RESOLVED ✅

### Known Leftover Patch Files (untracked, safe to delete)
```
~/Dev/DigitalSanctum/patch_models.py
~/Dev/DigitalSanctum/patch_main.py
~/Dev/DigitalSanctum/deploy_blueprint.sh
~/Dev/DigitalSanctum/seed_template_wix_11ty.py
~/Dev/DigitalSanctum/sanctum-web/sweep_toast.py
```

---

## 3. KNOWN ISSUES / TECH DEBT

- **`api_test.sh`** — does not support `-e dev|prod` flag. Uses `API_BASE` env var instead. Inconsistent with other scripts. QoL ticket worthy.
- **`create_milestone.sh`** — no `--project-name` fuzzy resolution (only `--project-id`).
- **`sanctum_common.sh` `resolve_project()`** — could be more defensive if `GET /projects` returns non-array on auth failure.
- **Template Library** — no `/templates/new` creation form yet (currently create via API or JSON import only).
- **Template sections** — no drag-to-reorder yet.
- **Tag filter** — tags searchable via text but no dedicated tag chip filter UI yet.
- **ToastContext** — exports `addToast` NOT `showToast`. Flag this in every new component — it has already caused one bug.

---

## 4. NEXT SPRINT — Phase 65: The Polish

### Item 1 — Layout Header Actions Unification
**Context:** Several modules have "Copy Metadata", "Refresh", and view-toggle buttons (single/dual column in TicketDetail, grid/list in Wiki). These are currently per-module. Move them into the sticky Layout header next to the notification bell — consistent position, consistent UX across all modules.

**Approach:**
- Layout already supports `onRefresh` and `onCopyMeta` props (opt-in callbacks)
- View toggle needs a new `onViewToggle` / `viewMode` prop pair added to Layout
- Modules pass their toggle state up via props
- Recon: `TicketDetail.jsx`, `LibraryIndex.jsx`, `Layout.jsx` header section (L192 area)

---

### Item 2 — TicketDetail Refresh Bug
**Context:** Refresh button in TicketDetail does not refresh comments — only ticket core data reloads. All related sub-modules (comments, time entries, materials, assets, linked articles) should reload on refresh.

**Approach:**
- Recon `TicketDetail.jsx` — find `load()` function and check what it fetches
- Likely fix: ensure comment fetch is inside the same `load()` triggered by refresh
- Surgical fix, likely 1–5 lines

---

### Item 3 — Bulk "Mark Paid" for Invoices
**Context:** `/invoices/unpaid` lists unpaid invoices. Current workflow requires entering each InvoiceDetail individually. Client paid two invoices in one payment — need to select multiple and apply a single "Mark Paid" flow.

**Approach:**
- Add checkbox selection to `UnpaidInvoices.jsx` list rows
- "Mark Selected Paid" CTA appears when ≥1 selected
- Modal: payment method, date, amount received, "send receipt email" toggle
- Backend: `POST /invoices/bulk-mark-paid` — array of IDs + payment details, atomic, fires receipt emails
- Recon: `UnpaidInvoices.jsx`, `invoices.py` router, `billing_service.py`

---

### Item 4 — Portal Project View + Backend ProjectDetail Review
**Context:** Client portal needs an attractive project view with milestones and ticket progress. User also wants a UX review of the backend ProjectDetail before portal work begins.

**Two parts:**
- A) **C-Suite consultation** on current `ProjectDetail.jsx` UX — assess quality, identify gaps
- B) **`PortalProjectDetail.jsx`** — client-facing milestone timeline, ticket status per milestone, progress indicators, no internal fields

**Suggested:** Open next session with C-Suite consultation on project UX before writing code.

---

### Item 5 — Bug: Add Asset in ClientDetail Goes Blank
**Context:** Clicking "Add Asset" in `ClientDetail.jsx` causes the modal to flash then the entire page goes blank. Likely a JS runtime error — missing prop or undefined variable in the asset modal.

**Approach:**
- Recon `ClientDetail.jsx` — find asset modal trigger
- Check console error (user to capture before next session)
- Likely surgical fix

---

## 5. IMPORTANT NOTES FOR NEXT SESSION

- **Auth:** `export SANCTUM_API_TOKEN=sntm_...` — mandatory, no TOTP
- **Toast hook:** ToastContext exports `addToast` — NOT `showToast`. Enforce in every new component.
- **Ticket workflow:** Always post resolution comment BEFORE marking ticket resolved
- **Delivery:** Surgical recon (grep/sed → cat -A → Python for multi-line JSX). Never sed for multi-line.
- **Migration:** Always `alembic revision --autogenerate` — never draft manually
- **API prefix:** `https://core.digitalsanctum.com.au/api`
- **Project ID (Sanctum Core v1.x):** `335650e8-1a85-4263-9a25-4cf2ca55fb79`
- **Blueprint milestone ID:** `3da65428-7634-4068-89e6-536e5d37fcfe`
- **Account ID (DS HQ):** `dbc2c7b9-d8c2-493f-a6ed-527f7d191068`
- **UI pattern:** Intelligence Dossier — reference `AssetDetail.jsx`
- **Layout props:** `onRefresh`, `onCopyMeta` are opt-in — wire on all new detail pages

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

# Recon — Item 1 (Layout header unification)
grep -n "onRefresh\|onCopyMeta\|viewMode\|toggleView" ~/Dev/DigitalSanctum/sanctum-web/src/components/Layout.jsx
grep -n "setView\|listView\|gridView\|toggleView\|onRefresh" ~/Dev/DigitalSanctum/sanctum-web/src/pages/TicketDetail.jsx | head -20
grep -n "setView\|listView\|gridView\|toggleView\|onRefresh" ~/Dev/DigitalSanctum/sanctum-web/src/pages/LibraryIndex.jsx | head -20

# Recon — Item 2 (TicketDetail refresh bug)
grep -n "load\|fetch\|comment\|refresh" ~/Dev/DigitalSanctum/sanctum-web/src/pages/TicketDetail.jsx | head -30

# Recon — Item 3 (Bulk mark paid)
grep -n "mark\|paid\|payment\|checkbox\|select" ~/Dev/DigitalSanctum/sanctum-web/src/pages/UnpaidInvoices.jsx | head -20
grep -n "mark_paid\|bulk\|payment" ~/Dev/DigitalSanctum/sanctum-core/app/routers/invoices.py | head -20

# Recon — Item 5 (ClientDetail asset bug)
grep -n "asset\|Asset\|modal\|Modal\|addAsset" ~/Dev/DigitalSanctum/sanctum-web/src/pages/ClientDetail.jsx | head -30
```
