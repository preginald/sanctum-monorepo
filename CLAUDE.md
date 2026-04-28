# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

SANCTUM_PROJECT_ID=335650e8-1a85-4263-9a25-4cf2ca55fb79

## Project Overview

Sanctum Core is a full-stack ERP/MSP/CRM platform for Digital Sanctum, a managed IT services business. It is both the product sold to clients and the internal system used to run the business (dogfooded).

- **Backend:** FastAPI (`sanctum-core/`), PostgreSQL, Alembic migrations
- **Frontend:** React 19 / Vite (`sanctum-web/`), deployed to core.digitalsanctum.com.au
- **CLI:** `sanctum.sh` (`scripts/dev/sanctum.sh`), symlinked as `sanctum`
- **Monorepo:** `github.com/preginald/sanctum-monorepo`
- **Production:** 159.223.82.75, auto-deploys on push to `main`

## Production SSH Access

Read SOP-109 via MCP (`article_show` with slug `SOP-109`, section `## SSH Access Model`) for the full SSH access model. Key points:

- **Automated/AI operations:** Use `sanctum-agent` (scoped sudo, deploy key). SSH alias: `sanctum-agent`.
- **Human/admin operations:** Use `preginald` via `sanctum-prod` (full sudo).
- **Never use `preginald` for automated deploys or AI-initiated SSH sessions.**
- GitHub Actions secrets (`USERNAME`, `SSH_KEY`) point to `sanctum-agent`.

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

### 3. Delivery Protocol (MANDATORY)

Applies to all templated ticket types (feature, bug, task, refactor). Relaxed for exempt types (hotfix, alert, support, access, maintenance, test) — though all 10 types now have enforced description templates (#927).

**Before starting a ticket:**
1. Read the full ticket description via MCP (`ticket_show`)
2. Read all linked articles via MCP (`article_show`)
3. Read all linked artefacts via MCP (`artefact_show`)
4. Verify description follows the type template (DOC-013 bug / DOC-014 task / DOC-015 refactor / DOC-016 feature)

**During implementation:**
1. Comment proposed solution on the ticket (`ticket_comment`) **before writing code**
2. Comment result after each significant attempt
3. If the approach changes, document why in a ticket comment

**Before resolving:**
1. Walk through every acceptance criterion — do not resolve with unchecked items
2. Post a resolution comment with: files changed, commit hash, deployment status
3. Use two-step resolve: `ticket_update` status=resolved, then `ticket_comment` with the resolution body

**After resolving:**
1. Check if KB articles need updating (especially DOC-009, DOC-045, or domain-specific docs)
2. Check if new KB articles should be created
3. Flag any process improvements discovered
4. Consider if `sanctum` CLI needs updates; update DOC-009 if so

**Never:**
- Never resolve without a resolution comment
- Never resolve without verifying all acceptance criteria
- Never create a ticket without following the type template
- Never skip reading linked articles and artefacts before starting

### 4. Session Handovers
- Every session ends by publishing a session handover as an MCP artefact (category: `session_handover`) linked to the active milestone(s) and project.
- The handover must include: what was accomplished, current state, what's next, and any blockers.
- The next session retrieves the handover via `artefact_show` or `artefact_list category=session_handover`.

## MCP Server (preferred for Claude Code)

The Sanctum MCP server (`sanctum-mcp/`) provides the same operations as the CLI via MCP tools. Claude Code should use MCP tools instead of `sanctum` CLI commands.

- **Location:** `sanctum-mcp/`
- **Start:** `cd sanctum-mcp && source venv/bin/activate && python server.py`
- **Endpoint:** `http://localhost:8100/` (streamable HTTP)
- **Auth:** OAuth 2.0 Authorization Code flow with PKCE
- **Domains:** ticket, article, milestone, invoice, search, artefact, project

MCP tools return structured JSON directly — no TTY issues, no `--yes` flag needed.

For the CLI identity and MCP migration covenant, see `docs/cli-identity-mcp-migration-covenant.md`.

## CLI: sanctum

The unified CLI tool lives at `scripts/dev/sanctum.sh` (symlinked as `sanctum`). Use the MCP tools above instead when operating from Claude Code.

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
- FastAPI routers in `app/routers/` (25 modules: tickets, invoices, wiki, portal, crm, sentinel, assets, artefacts, search, etc.)
- Business logic services in `app/services/` (billing, email via Resend, notifications, PDF generation, event bus, sentinel security scanning)
- Pydantic schemas in `app/schemas/`
- SQLAlchemy 2.0 models in `app/models.py` (single file, all entities)
- Background worker in `app/worker.py`
- Alembic migrations in `alembic/versions/`
- Write migration files but **do not run them** — Pete runs `alembic upgrade head` on prod.
- Key env vars: `DATABASE_URL`, `SECRET_KEY`, `RESEND_API_KEY`, `FRONTEND_URL`

### Frontend (sanctum-web/)
- React pages in `src/pages/` (50+ pages)
- Reusable components in `src/components/` (organized by domain: tickets/, invoices/, clients/, portal/, knowledge/, etc.)
- **Intelligence Dossier** (DS-UX-001) is the standard UI pattern for detail pages
- **MetadataStrip** is the platform-wide UI standard (replaces `subtitle`/`badge` props on Layout)
- API client in `src/lib/api.js` (Axios with interceptors)
- State management: Zustand (`src/store/`)
- Styling: Tailwind CSS
- Tests use Vitest + Testing Library + MSW for API mocking (`src/test/`)
- **Live browser verification** (per SOP-149): Playwright MCP is installed on this project for UI tickets whose ACs can't be proven by mocked tests (drag/drop, keyboard a11y, animations, real-network auth). Chrome DevTools MCP remains as a fallback/complement for DevTools-specific work (perf traces, Lighthouse).

### Knowledge Base
- Articles use identifiers like `DOC-001`, `SOP-099`, `SYS-007`, `WIKI-024`
- Never use static `## Related` sections — always use graph edges via `--articles` and `--relate-tickets`
- Wire `--relate-tickets` and `--articles` flags at ticket/article creation time

## Key References

| Identifier | What |
|---|---|
| SOP-099 | The Phoenix Protocol — session migration & operational workflow |
| SOP-102 | Ticket Delivery Checklist |
| SOP-149 | Live Browser Verification for UI Features (Playwright MCP + CDP fallback) |
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
- Pete tests and merges to `main` after verifying the branch (see SOP-121 for full merge policy). Pushes to `main` auto-deploy to production.
- Commit messages reference ticket numbers: `#574: add create-batch command`
- **Never force push to main.**
- **Rollback rule:** If a merge to `main` breaks production, immediately `git revert` the commit rather than attempting a forward fix.

## Cost-Aware Routing

The `/deliver` pipeline routes each phase to the cheapest model that can handle it:

| Phase | Agent | Model | Rationale |
|---|---|---|---|
| Recon | `sanctum-recon` | sonnet | Light/standard reads only |
| Propose | `sanctum-reviewer` | opus | Complex reasoning required |
| Implement | `sanctum-implementer` | opus | Code generation |
| Verify | `sanctum-qa` | sonnet | Structured verification |
| Review | `sanctum-reviewer` | opus | Defensive code review |
| Document | `sanctum-writer` | sonnet | Documentation updates |

**Override:** The Operator can force opus for recon by delegating to `sanctum-reviewer` instead of `sanctum-recon` when the ticket involves complex cross-system dependencies or security-sensitive analysis.

## Session Efficiency

- **Keep sessions focused.** One ticket or task per session where possible. Use `/clear` between unrelated tasks to keep context lean.
- **Break large features into discrete commits** on the feature branch rather than one massive change.
- **Prefer small, verifiable steps** over marathon sessions — this conserves usage allowance and reduces risk.
