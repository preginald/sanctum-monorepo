# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sanctum Core is a full-stack ERP/MSP/CRM platform for Digital Sanctum, a managed IT services business. It is both the product sold to clients and the internal system used to run the business (dogfooded).

- **Backend:** FastAPI (`sanctum-core/`), PostgreSQL, Alembic migrations
- **Frontend:** React 19 / Vite (`sanctum-web/`), deployed to core.digitalsanctum.com.au
- **CLI:** `sanctum.sh` (`scripts/dev/sanctum.sh`), symlinked as `sanctum`
- **Monorepo:** `github.com/preginald/sanctum-monorepo`
- **Production:** 159.223.82.75, user `preginald`, auto-deploys on push to `main`

## Common Commands

### Backend (sanctum-core/)
```bash
cd sanctum-core
source venv/bin/activate
uvicorn app.main:app --reload          # Start API server on :8000
python -m app.worker                   # Run background worker
pytest                                 # Run all tests
pytest tests/core_internal/unit/test_billing.py  # Single test file
pytest -k "test_name"                  # Single test by name
pytest --cov                           # With coverage
```

### Frontend (sanctum-web/)
```bash
cd sanctum-web
npm run dev                            # Vite dev server on :5173
npm run build                          # Production build
npm run test                           # Vitest
npm run lint                           # ESLint
```

Vite proxies `/api/*` and `/static/*` to `http://127.0.0.1:8000` — both servers must be running for local dev.

### Pre-commit Hooks
Configured via `.pre-commit-config.yaml`: trailing whitespace, large file checks, YAML validation, ShellCheck for `scripts/**/*.sh`, Black for `scripts/**/*.py`.

## Development Doctrines

### 1. Consultative (MANDATORY)
- **No unsolicited code.** Propose a technical solution and wait for approval before writing code.
- **One step at a time.** Do not combine plans and code in one response.

### 2. Surgical Reconnaissance (MANDATORY)
- **Recon before edit.** Use `grep -n` and `sed -n` to scan the codebase before proposing changes.
- **Minimal changes.** Target only the lines that need to change — don't rewrite entire files.
- **New files only exception.** Full file output is acceptable only for files that don't exist yet.
- **40% threshold.** If changing >40% of a file, full replacement is acceptable.
- **Always verify.** After any change, run a grep to confirm nothing was missed.

### 3. Delivery Pattern
1. Create a ticket for the work (if one doesn't exist)
2. Perform surgical recon, update ticket comment with proposed solution
3. Implement the proposed solution
4. Verify
5. Update ticket with resolution (resolve via two-step flow)
6. Create or update any related KB articles
7. Consider if `sanctum` CLI needs update with new or existing domain
8. Make sure `sanctum` has `--help` for the domain
9. Update the sanctum CLI article (DOC-009) with new additions

### 4. Session Handovers
- Every session ends with a `session_handover.md` summarising what was done, what's next, and commands for the next session.

## CLI: sanctum

The unified CLI tool lives at `scripts/dev/sanctum.sh` (symlinked as `sanctum`).

- **Check DOC-009** before using any subcommand — don't guess flags.
- **Use `--articles` flag** when creating tickets to link relevant KB articles.
- **Use `-f /tmp/file.md`** for large content — write to `/tmp/` first, then reference with `-f` flag.

### Domains
- `ticket` — create, update, comment, resolve, list, show, delete, create-batch
- `article` — create, update, show
- `milestone` — create, update, list, show
- `invoice` — create, update, delete, show
- `context` — batch article reader (`context load DOC-001,DOC-002,...`)
- `search` — omnisearch across all entities

### Two-Step Ticket Resolve Flow
1. `sanctum ticket update <id> --status resolved`
2. `sanctum ticket resolve <id>` (adds resolution comment)

## Architecture Conventions

### Backend (sanctum-core/)
- FastAPI routers in `app/routers/` (24 modules: tickets, invoices, wiki, portal, crm, sentinel, assets, search, etc.)
- Business logic services in `app/services/` (billing, email via Resend, notifications, PDF generation, event bus, sentinel security scanning)
- Pydantic schemas in `app/schemas/`
- SQLAlchemy 2.0 models in `app/models.py` (single file, all entities)
- Background worker in `app/worker.py`
- Alembic migrations in `alembic/versions/`
- Write migration files but **do not run them** — Pete runs `alembic upgrade head` on prod.
- Key env vars: `DATABASE_URL`, `SECRET_KEY`, `RESEND_API_KEY`, `FRONTEND_URL`

### Frontend (sanctum-web/)
- React pages in `src/pages/` (42+ pages)
- Reusable components in `src/components/` (organized by domain: tickets/, invoices/, clients/, portal/, knowledge/, etc.)
- **Intelligence Dossier** (DS-UX-001) is the standard UI pattern for detail pages
- **MetadataStrip** is the platform-wide UI standard (replaces `subtitle`/`badge` props on Layout)
- API client in `src/lib/api.js` (Axios with interceptors)
- State management: Zustand (`src/store/`)
- Styling: Tailwind CSS
- Tests use Vitest + Testing Library + MSW for API mocking (`src/test/`)

### Knowledge Base
- Articles use identifiers like `DOC-001`, `SOP-099`, `SYS-007`, `WIKI-024`
- Never use static `## Related` sections — always use graph edges via `--articles` and `--relate-tickets`
- Wire `--relate-tickets` and `--articles` flags at ticket/article creation time

## Key References

| Identifier | What |
|---|---|
| SOP-099 | The Phoenix Protocol — session migration & operational workflow |
| DOC-009 | CLI Guide: sanctum.sh |
| DOC-001 | API Guide: Managing Tickets |
| DOC-012 | UI Standard: SendNotificationForm |
| SYS-007 | Frontend Architecture & UX Standards |
| WIKI-024 | Surgical Reconnaissance methodology |
| DOC-028 | SSH Configuration |
| DOC-029 | Manual Deployment |

## Key UUIDs

- **Digital Sanctum HQ account:** `dbc2c7b9-d8c2-493f-a6ed-527f7d191068`
- **Sanctum Core project:** `335650e8-1a85-4263-9a25-4cf2ca55fb79`

## Git Workflow

- **Always work on a feature branch** (`feat/<ticket>-<description>`). Never commit directly to `main`.
- Pete tests and merges to `main` after verifying the branch. Pushes to `main` auto-deploy to production.
- Commit messages reference ticket numbers: `#574: add create-batch command`
- **Never force push to main.**
- **Rollback rule:** If a merge to `main` breaks production, immediately `git revert` the commit rather than attempting a forward fix.

## Session Efficiency

- **Keep sessions focused.** One ticket or task per session where possible. Use `/clear` between unrelated tasks to keep context lean.
- **Break large features into discrete commits** on the feature branch rather than one massive change.
- **Prefer small, verifiable steps** over marathon sessions — this conserves usage allowance and reduces risk.
