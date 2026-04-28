# CLI Identity & MCP Migration Covenant

Ticket: #3130

This document records the operating contract for the CLI identity and MCP migration work. It is intended to be the repo-backed source that agents can use when the KB is unavailable or when article content cannot be fetched safely.

## Canonical Model

- `sanctum-cli` is the primary CLI for AI and human automation. The legacy bash CLI at `scripts/dev/sanctum.sh` remains available for compatibility, but new automation should target the Python CLI contract documented in `CLAUDE.md`.
- AI operations must use named service identities through `--agent <name>` rather than a shared anonymous token.
- Human operations that need user attribution must use `--user <email>` and the user token store.
- MCP consumers authenticate to the MCP server with an MCP JWT, then select their downstream Core API identity with `X-Sanctum-Agent`.
- Core API authorization remains bearer-token based. MCP per-request identity swaps the downstream Core token via ContextVars and resets it after each request.

## Agent Identities

The active agent identities are:

| Agent | Environment Variable | Primary Use |
|---|---|---|
| `architect` | `SANCTUM_TOKEN_ARCHITECT` | Design, review, recon, resolution |
| `surgeon` | `SANCTUM_TOKEN_SURGEON` | Implementation, ticket updates, time entries |
| `sentinel` | `SANCTUM_TOKEN_SENTINEL` | QA and verification |
| `scribe` | `SANCTUM_TOKEN_SCRIBE` | KB and documentation writes |
| `oracle` | `SANCTUM_TOKEN_ORACLE` | Read-only search and lookup |
| `guardian` | `SANCTUM_TOKEN_GUARDIAN` | Security engineering |
| `hermes` | `SANCTUM_TOKEN_HERMES` | Infrastructure and operations |
| `chat` | `SANCTUM_TOKEN_CHAT` | Chat interface operations |
| `mock` | `SANCTUM_TOKEN_MOCK` | Test automation |
| `operator` | not AI-resolvable | Reserved for human/operator use |

Short names such as `surgeon` map to `SANCTUM_TOKEN_SURGEON`. MCP header names use the `sanctum-` prefix, for example `X-Sanctum-Agent: sanctum-surgeon`.

## CLI Rules

- Every Python CLI command must include either `--agent <name>` or `--user <email>`.
- Token fallback is explicit: agent flag, matching environment variable, matching agent env file, then failure.
- There must be no silent fallback from an agent identity to `operator` or a shared default token.
- The bash CLI is legacy. It may still be used in existing workflows, but its behavior must not be treated as the canonical identity model.
- Documentation examples should prefer Python CLI syntax unless they are specifically documenting `scripts/dev/sanctum.sh`.

## MCP Rules

- The MCP server accepts OAuth/JWT credentials for the MCP connection itself.
- `X-Sanctum-Agent` selects the Core API service token for downstream tool calls.
- `sanctum-mcp/middleware/agent_identity.py` is the implementation point for per-request Core identity resolution.
- `sanctum-mcp/client.py` and telemetry consume ContextVars set by the middleware.
- Unknown or absent agent headers currently fall back to the process default token; this is runtime behavior, not permission to rely on anonymous automation.
- Single-identity consumers should register one MCP server entry with a fixed `X-Sanctum-Agent` header. Multi-agent consumers such as Claude Code can register one server entry per identity.

## Consumer Expectations

- Claude Code uses multiple MCP registrations so subagent routing can choose the correct tool namespace and identity.
- Gemini CLI can use `scripts/dev/gemini-mcp-add.sh` to register an MCP endpoint with a long-lived JWT and fixed `X-Sanctum-Agent` header.
- Hermes deployments must use the identity appropriate to their execution context. Production infrastructure automation uses the scoped deployment/infra identity, not a human admin account.

## Verification Checklist

- Confirm CLI help and docs show the Python CLI as primary and the bash CLI as legacy.
- Confirm all automation examples include either `--agent` or `--user`.
- Confirm MCP docs distinguish MCP authentication from downstream Core API identity.
- Confirm `X-Sanctum-Agent` values and `SANCTUM_TOKEN_*` variables stay aligned.
- Confirm no documentation recommends using `preginald`, `operator`, or a shared token for AI-initiated automated work.
- Confirm KB follow-ups are assessed after repo docs change, especially DOC-009 and SYS-057.

## Known KB Follow-Ups

- DOC-009 should continue to describe the legacy bash CLI accurately while pointing agents at the Python CLI where appropriate.
- SYS-057 should remain the canonical KB article for `AgentIdentityMiddleware` and MCP per-request identity.
- The ticket description for #3130 had no acceptance criteria at delivery time, so this repo document preserves the covenant in a verifiable commit.
