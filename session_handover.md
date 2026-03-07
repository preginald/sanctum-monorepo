# Session Handover — Phase 74/75: The Foreman + DevOps Foundation
Date: 2026-03-07

## What We Accomplished

### #383 — Article History Tab: Pagination + Inline Word Diff ✅
- Generic `Page[T]` schema added to `sanctum-core/app/schemas/shared.py`
- `GET /articles/{id}/history` now paginated (page, page_size, section_heading params)
- `ArticleDetail.jsx` — inline word-level diff using `jsdiff`, section filter dropdown, pagination controls
- `diff` npm package installed in sanctum-web
- Commit: `d6b8213`

### #384 — Generic Pagination Rollout Ticket ✅ (created, open)
- Tracks rolling out `Page[T]` to all list endpoints (tickets, articles, invoices, etc.)

### Phase 75: DevOps & Automation — Milestone + Tickets Created ✅
- Milestone: Phase 75: DevOps & Automation (85eb520e)
- #385 — sanctum.sh omnisearch integration (open — next session)
- #386 — Pre-commit hook sanity checks (open)
- #387 — Deploy script ✅ resolved
- #388 — Dev/prod schema drift detection (open)

### #387 — Deploy Script ✅
- `scripts/ops/deploy.sh` delivered — manual fallback deployment script
- Steps: SSH check → git pull --ff-only → migration check/apply → pip install → npm build → systemctl restart sanctum-api → health check → deploy log
- `--dry-run` flag supported
- Health endpoint confirmed: `/api/system/health`
- Commit: `edc373a`

### SSH Alias ✅
- `sanctum-prod` alias added to `~/.ssh/config` (host: 159.223.82.75, user: preginald)
- DOC-028 created — SSH Configuration & Server Access
- DOC-029 created — Manual Deployment — Fallback Deploy Script

### Divergent Branch Issue Resolved ✅
- `scripts/dev/migrate_article_history_diffs.py` removed from repo (one-off script, already run)
- Merge conflict on prod resolved via `git rm` + push

## Current State

- Git: `main` branch, commit `edc373a`, clean
- Prod: fully deployed and healthy
- Phase 75 milestone seeded with 4 tickets (#385–#388)
- SOP-099: v2.29 (needs update — see below)

## Open Tickets (This Session)

| # | Subject | Milestone |
|---|---|---|
| #384 | Generic pagination — roll out Page[T] to all list endpoints | Phase 55 |
| #385 | sanctum.sh omnisearch integration | Phase 75 |
| #386 | Pre-commit hook — sanity checks | Phase 75 |
| #388 | Dev/prod schema drift detection | Phase 75 |

## Next Session: #385 — sanctum.sh Omnisearch Integration

Add `sanctum.sh search <query>` subcommand hitting `GET /search?q=<query>`.
- Scope results with optional `--type` flag (tickets, articles, milestones, etc.)
- Format results in readable CLI table grouped by type
- Will also fix the pain point of needing to list all milestones just to find one by keyword
- Related: #328 (Omnisearch fuzzy matching accuracy — separate issue)

## SOP-099 Updates Needed (v2.30)

1. Add `deploy.sh` to Section 4 or Appendix — document the fallback deploy workflow
2. Add `sanctum-prod` SSH alias setup to Section 4 or Appendix
3. Add to Appendix D accelerators:
   - ✅ Write content to `/tmp/` before `sanctum.sh article create/update -f` to avoid token-costly heredoc retries
   - ✅ Check DOC-009 before using any sanctum.sh subcommand — never guess flags
   - ✅ `git push 2>&1 | srun` — git push writes to stderr, pipe both streams
   - ✅ Deploy script as fallback when GitHub Actions fails
4. Add to Appendix D anti-patterns:
   - ❌ Direct SSH edits to tracked files on prod — causes divergent branch on next deploy
   - ❌ Plain `git pull` in deploy contexts — use `--ff-only` to abort on divergence

## Key Patterns Established This Session

- `Page[T]` generic pagination schema — reuse for all future paginated endpoints
- `sanctum-prod` SSH alias — use in all scripts and remote commands
- `deploy.sh` as emergency fallback — GitHub Actions remains primary pipeline
- All tickets must include `--articles` and typed `--relate-tickets` on creation to maintain knowledge graph integrity

## Commands for Next Session
```bash
# Start dev environment
cd sanctum-core && source venv/bin/activate && uvicorn app.main:app --reload
cd sanctum-web && npm run dev

# Check #385 ticket
./scripts/dev/sanctum.sh ticket show 385 -e prod

# Test omnisearch endpoint before CLI work
curl -s "https://core.digitalsanctum.com.au/api/search?q=devops" \
  -H "Authorization: Bearer $SANCTUM_API_TOKEN" | jq '.'
```
