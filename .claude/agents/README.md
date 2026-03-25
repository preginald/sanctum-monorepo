# Agent Roster — Orchestration Guide

## Agents

| Agent | Identity | Role | Model | MCP Server |
|---|---|---|---|---|
| `sanctum-recon` | The Architect (Recon) | Ticket reconnaissance and codebase scanning | sonnet | `sanctum-architect` |
| `sanctum-reviewer` | The Architect | Planning, review, verification, KB governance | opus | `sanctum-architect` |
| `sanctum-implementer` | The Surgeon | Code editing, tests, git, deployment | opus | `sanctum-surgeon` |
| `sanctum-qa` | The Sentinel | AC verification, regression testing, smoke tests | sonnet | `sanctum-sentinel` |
| `sanctum-writer` | The Scribe | KB articles, documentation, artefacts | sonnet | `sanctum-scribe` |

### Parent Session Identities

| Context | Identity | MCP Server |
|---|---|---|
| Claude Chat (claude.ai) | The Oracle | `sanctum-oracle` / `sanctum-chat` |
| Claude Code (parent session) | The Operator | `sanctum-operator` / `sanctum-code` |

## Architecture

All 6 identities share a **single MCP server process** (port 8100). Identity is determined by the Bearer token each named MCP server entry sends. The MCP server extracts the token from the incoming request and passes it through to the Sanctum Core API, where it resolves to the corresponding service account.

```
Claude Code
  |
  |-- sanctum-architect (Bearer sntm_architect_...) --\
  |-- sanctum-surgeon   (Bearer sntm_surgeon_...)  ---|
  |-- sanctum-sentinel  (Bearer sntm_sentinel_...) ---|--- MCP Server (:8100) ---> Core API
  |-- sanctum-scribe    (Bearer sntm_scribe_...)   ---|
  |-- sanctum-operator  (Bearer sntm_operator_...) ---/
  |-- sanctum-oracle    (Bearer sntm_oracle_...)   --/
```

## Service Accounts

| Identity | UUID | Email |
|---|---|---|
| The Oracle | `a1b2c3d4-0001-4000-8000-000000000001` | `claude-chat@system.local` |
| The Operator | `a1b2c3d4-0002-4000-8000-000000000002` | `claude-code@system.local` |
| The Architect | `a1b2c3d4-0003-4000-8000-000000000003` | `the-architect@system.local` |
| The Surgeon | `a1b2c3d4-0004-4000-8000-000000000004` | `the-surgeon@system.local` |
| The Sentinel | `a1b2c3d4-0005-4000-8000-000000000005` | `the-sentinel@system.local` |
| The Scribe | `a1b2c3d4-0006-4000-8000-000000000006` | `the-scribe@system.local` |

## Setup

### 1. Run migration (Pete runs on prod)
```bash
cd sanctum-core && source venv/bin/activate
alembic upgrade head
```

### 2. Generate tokens for new accounts
```bash
python scripts/generate_service_tokens.py
```
Save each token to the corresponding `sanctum-mcp/.env.<identity>` file:
- `.env.oracle` — The Oracle (existing, was `.env.chat`)
- `.env.operator` — The Operator (existing, was `.env.code`)
- `.env.architect` — The Architect (new)
- `.env.surgeon` — The Surgeon (new)
- `.env.sentinel` — The Sentinel (new)
- `.env.scribe` — The Scribe (new)

### 3. Configure Claude Code MCP entries
```bash
scripts/dev/mcp-setup.sh
```

### 4. Start the MCP server
```bash
scripts/dev/mcp-server.sh start
scripts/dev/mcp-server.sh status
scripts/dev/mcp-server.sh stop
```

## Token Cost Estimates

| Agent | Model | Est. Multiplier | Notes |
|---|---|---|---|
| `sanctum-recon` | sonnet | ~1x | Read-only recon, minimal reasoning |
| `sanctum-reviewer` | opus | ~2-3x | Complex reasoning, full ticket analysis |
| `sanctum-implementer` | opus | ~2-3x | Code generation, surgical edits |
| `sanctum-qa` | sonnet | ~1.5-2x | Structured verification, test execution |
| `sanctum-writer` | sonnet | ~1.5-2x | Documentation, article updates |

## Standard Orchestration Flow

### Full Ticket Delivery (recon -> propose -> implement -> verify -> review)

```
Parent Session (The Operator)
  |
  |-- 1. sanctum-recon (sonnet): "Read ticket #NNN, scan linked articles/artefacts,
  |       grep codebase for affected files. Post recon summary."
  |
  |-- 2. sanctum-reviewer (opus): "Read ticket #NNN and recon comment. Formulate
  |       proposal. Post proposal and review verdict."
  |
  |-- [Pete reviews and approves proposal]
  |
  |-- 3. sanctum-implementer (opus): "Read the approved proposal comment
  |       on ticket #NNN. Implement the solution. Commit and push to feature
  |       branch. Post an implementation comment with files changed and commit hash."
  |
  |-- 4. sanctum-qa (sonnet): "Read ticket #NNN. Verify every acceptance
  |       criterion against the implementation. Run tests. Post a verification
  |       report comment."
  |
  |-- 5. sanctum-reviewer (opus): "Read ticket #NNN. Review code diff. Post verdict."
  |
  |-- 6. [If approved] Parent resolves ticket
  |-- 6. [If changes requested] Loop back to step 3
```

### KB Update After Delivery

```
Parent Session
  |-- sanctum-writer (The Scribe): "Ticket #NNN has been resolved. Check if any
                       KB articles need updating based on the changes. Update
                       DOC-009 if CLI changed. Create new articles if a new
                       feature was shipped."
```

### Review-Only (no code changes)

```
Parent Session
  |-- sanctum-reviewer (The Architect): "Review ticket #NNN. Check the description
                         follows the type template. Verify linked articles exist.
                         Post findings."
```

## Cost-Tier Routing Guidance

Every MCP tool carries a `cost_tier` annotation (via `ToolAnnotations`) that classifies its complexity. Orchestrators should use these tiers when deciding which agent to delegate to.

### Tier Taxonomy

| Tier | MCP Hints | Tool Count | Examples |
|---|---|---|---|
| `light` | readOnly, idempotent | 16 | `ticket_list`, `search`, `article_sections`, `artefact_history` |
| `standard` | readOnly, idempotent | 7 | `ticket_show`, `article_show`, `project_overview` |
| `heavy` | not readOnly | 30 | `ticket_create`, `ticket_update`, `artefact_link`, `article_revert` |
| `destructive` | destructive | 4 | `ticket_delete`, `artefact_delete`, `invoice_delete`, `time_entry_delete` |

### Routing Rules

- **Light-tier tools** are safe for any agent. Prefer delegating to sonnet-class agents (`sanctum-qa`, `sanctum-writer`) when the task only requires reads.
- **Standard-tier tools** may return large payloads (expand). Still read-only, but consider whether the task needs opus-class reasoning to interpret the result.
- **Heavy-tier tools** modify state. Delegate to the appropriate specialist (`sanctum-implementer` for code, `sanctum-reviewer` for ticket/KB management).
- **Destructive-tier tools** are irreversible. The parent orchestrator should confirm before delegating, and prefer opus-class agents for the decision.

### How Annotations Are Exposed

Annotations are set via `ToolAnnotations` on each `@mcp.tool()` decorator. They appear in the MCP tool listing response under the `annotations` field. The custom `cost_tier` field is added via Pydantic's `extra="allow"` on `ToolAnnotations`.

## When to Use Each Agent

| Scenario | Agent | Identity |
|---|---|---|
| Scan a ticket and codebase for recon | `sanctum-recon` | The Architect (Recon) |
| Read a ticket and propose a solution | `sanctum-reviewer` | The Architect |
| Review a PR or diff for issues | `sanctum-reviewer` | The Architect |
| Check if a ticket follows template conventions | `sanctum-reviewer` | The Architect |
| Write or edit source code | `sanctum-implementer` | The Surgeon |
| Create a migration | `sanctum-implementer` | The Surgeon |
| Run tests | `sanctum-qa` | The Sentinel |
| Verify acceptance criteria after implementation | `sanctum-qa` | The Sentinel |
| Create or update a KB article | `sanctum-writer` | The Scribe |
| Create a session handover artefact | `sanctum-writer` | The Scribe |

## Constraints

- **No nesting.** Subagents cannot spawn other subagents. The parent orchestrates all steps.
- **No real-time polling.** Agents can't watch for changes. The parent checks and delegates.
- **Single MCP process.** All agents share one server — identity comes from the Bearer token, not the server instance.
- **Tool restrictions require named invocation.** The generic `Agent` tool inherits all parent tools. Named agent definitions (`.claude/agents/*.md`) enforce tool boundaries.

## Deferred Roles

Add these only when workflow friction justifies the token cost:

- **Strategist** — project planning, milestone sequencing, ADR drafting
- **DevOps** — infrastructure, CI/CD, deploy scripts
- **Security auditor** — code review for vulnerabilities, dependency scanning
