# Agent Roster — Orchestration Guide

## Agents

| Agent | Role | Model | MCP Server | Identity |
|---|---|---|---|---|
| `sanctum-reviewer` | Planning, review, verification, KB governance | opus | `sanctum-chat` (8100) | Claude Chat |
| `sanctum-implementer` | Code editing, tests, git, deployment | opus | `sanctum-code` (8101) | Claude Code |
| `sanctum-qa` | AC verification, regression testing, smoke tests | sonnet | `sanctum-code` (8101) | Claude Code |
| `sanctum-writer` | KB articles, documentation, artefacts | sonnet | `sanctum-chat` (8100) | Claude Chat |

## Token Cost Estimates

| Agent | Model | Est. Multiplier | Notes |
|---|---|---|---|
| `sanctum-reviewer` | opus | ~2-3x | Complex reasoning, full ticket analysis |
| `sanctum-implementer` | opus | ~2-3x | Code generation, surgical edits |
| `sanctum-qa` | sonnet | ~1.5-2x | Structured verification, test execution |
| `sanctum-writer` | sonnet | ~1.5-2x | Documentation, article updates |

## Starting the MCP Servers

Both servers must be running before invoking agents:

```bash
# Start both (recommended)
scripts/dev/mcp-dual.sh start

# Check status
scripts/dev/mcp-dual.sh status

# Stop both
scripts/dev/mcp-dual.sh stop
```

Or manually in separate terminals:
```bash
# Terminal 1 — Chat identity (port 8100)
cd sanctum-mcp && source venv/bin/activate
SANCTUM_API_TOKEN=$(grep SANCTUM_API_TOKEN .env.chat | cut -d= -f2) MCP_PORT=8100 MCP_AUTH_ENABLED=false python server.py

# Terminal 2 — Code identity (port 8101)
cd sanctum-mcp && source venv/bin/activate
SANCTUM_API_TOKEN=$(grep SANCTUM_API_TOKEN .env.code | cut -d= -f2) MCP_PORT=8101 MCP_AUTH_ENABLED=false python server.py
```

## Standard Orchestration Flow

### Full Ticket Delivery (reviewer -> implementer -> qa)

```
Parent Session
  |
  |-- 1. sanctum-reviewer: "Read ticket #NNN, check linked articles and artefacts.
  |                          Post a proposed solution as a ticket comment."
  |
  |-- [Pete reviews and approves proposal]
  |
  |-- 2. sanctum-implementer: "Read the approved proposal comment on ticket #NNN.
  |                             Implement the solution. Commit and push to feature branch.
  |                             Post an implementation comment with files changed and commit hash."
  |
  |-- 3. sanctum-qa: "Read ticket #NNN. Verify every acceptance criterion against the
  |                    implementation. Run tests. Post a verification report comment."
  |
  |-- 4. [If QA passes] Parent resolves ticket
  |-- 4. [If QA fails] Loop back to step 2 with QA findings
```

### KB Update After Delivery

```
Parent Session
  |-- sanctum-writer: "Ticket #NNN has been resolved. Check if any KB articles need
                        updating based on the changes. Update DOC-009 if CLI changed.
                        Create new articles if a new feature was shipped."
```

### Review-Only (no code changes)

```
Parent Session
  |-- sanctum-reviewer: "Review ticket #NNN. Check the description follows the type
                          template. Verify linked articles exist. Post findings."
```

## When to Use Each Agent

| Scenario | Agent |
|---|---|
| Read a ticket and propose a solution | `sanctum-reviewer` |
| Review a PR or diff for issues | `sanctum-reviewer` |
| Check if a ticket follows template conventions | `sanctum-reviewer` |
| Write or edit source code | `sanctum-implementer` |
| Create a migration | `sanctum-implementer` |
| Run tests | `sanctum-qa` |
| Verify acceptance criteria after implementation | `sanctum-qa` |
| Create or update a KB article | `sanctum-writer` |
| Create a session handover artefact | `sanctum-writer` |

## Constraints

- **No nesting.** Subagents cannot spawn other subagents. The parent orchestrates all steps.
- **No real-time polling.** Agents can't watch for changes. The parent checks and delegates.
- **MCP servers are session-level.** Subagents use the parent's MCP connections by server name.
- **Tool restrictions require named invocation.** The generic `Agent` tool inherits all parent tools. Named agent definitions (`.claude/agents/*.md`) enforce tool boundaries.

## Deferred Roles

Add these only when workflow friction justifies the token cost:

- **Strategist** — project planning, milestone sequencing, ADR drafting
- **DevOps** — infrastructure, CI/CD, deploy scripts
- **Security auditor** — code review for vulnerabilities, dependency scanning
