# SESSION HANDOVER — 2026-02-19

## 0. WHAT WE ACCOMPLISHED

### Ticket #186 — KB List View & Bulk Actions ✅
- **View Toggle:** Added Grid/List toggle to `LibraryIndex.jsx` with `localStorage` persistence.
- **Unified Table:** Created `src/components/ui/Table.jsx` (Header, Body, Row, Cell) matching Sanctum Dark Mode.
- **Bulk Actions:** Implemented `Checkbox` component and "Bulk Category Move" logic (Client-side iteration).
- **Outcome:** Users can now manage large KB libraries efficiently.

### Ticket #187 — Global Table Standardisation ✅
- **Refactor:** Replaced ad-hoc HTML `<table>` tags in **14 pages** with the new `Table` component.
- **Methodology:** Used `scripts/dev/refactor_safe.py` (Literal String Replacement) to ensure zero code corruption.
- **Pages Updated:** Tickets, Clients, Invoices, Assets, Admin Lists, Audits, etc.

### Infrastructure
- **New Scripts:**
  - `scripts/dev/setup_kb_milestone.py`: Automates Milestone/Ticket creation via API.
  - `scripts/dev/refactor_safe.py`: Robust tool for HTML->React component refactoring without Regex risks.

## 1. CURRENT STATE

### Production
- **App:** https://app.digitalsanctum.com.au
- **API:** https://core.digitalsanctum.com.au/api
- **Database:** Production DB updated with Ticket #186, #187 and Milestone "Knowledge Base 2.0".

### Git
- **Branch:** main
- **Latest Component:** `src/components/ui/Table.jsx` (The new standard).

## 2. KNOWN ISSUES / TECH DEBT

- **Bulk API:** Bulk operations (e.g., Move Category) currently loop through IDs on the client side (`Promise.all` or sequential). Future optimization should add a bulk endpoint to the backend (`PUT /articles/bulk`).
- **Date Formatting:** Some tables use `new Date().toLocaleDateString()` which depends on the user's browser locale. Should standardize to `date-fns` or a shared formatter.

## 3. NEXT SPRINT: Project Templates (Ticket #16)

**Objective:** Create a reusable "Project Template" system to standardize service delivery (e.g., "Standard Audit", "Onboarding").

**Requirements:**
1.  **Database:**
    - `ProjectTemplate` (name, description, default_budget)
    - `MilestoneTemplate` (name, offset_days, billable_percentage)
2.  **API:**
    - CRUD for Templates.
    - `POST /projects/from-template` (Instantiator logic).
3.  **UI:**
    - Template Manager (Settings/Admin).
    - "Create from Template" modal in Projects view.

**Strategic Question:** How do we handle dates? (Relative offsets vs fixed).

## 4. IMPORTANT NOTES FOR NEXT AI SESSION

- **Auth:** `export SANCTUM_API_TOKEN=$(cat ~/.sanctum/tokens/prod.txt)`
- **Table Component:** Always use `import { Table, TableHeader... } from '../components/ui/Table'` for any new tabular views. Do not write raw HTML tables.
- **Refactoring:** If further refactoring is needed, avoid Regex for HTML tags. Use `refactor_safe.py` as a reference implementation (Explicit String Replacement).