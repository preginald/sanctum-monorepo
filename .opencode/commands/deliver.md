---
description: Autonomous SOP-102 delivery pipeline — auto-detect next ticket from handover or run full pipeline for a specific ticket.
---

# Deliver

Autonomous SOP-102 delivery pipeline.

## Mode 1: Specific ticket — `/deliver <ticket#>`

Deliver that ticket through the full pipeline.

## Mode 2: Auto-detect — `/deliver`

Determine the next task:

1. **Read the latest session handover** — search artefacts for the most recent `session_handover` and read it via `sanctum --agent oracle artefact show <id>`. Extract the "What's Next" section.
2. **Check milestone state** — run `sanctum --agent oracle milestone list -p "Sanctum Core"` to find the active milestone.
3. **Check ticket state** — for the next ticket, run `sanctum --agent oracle ticket show <id> -c -r`. Read all linked articles and comments.
4. **Determine the delivery phase** based on ticket status and comments:
   - No comments → start at Recon
   - Recon done but no proposal → start at Propose
   - Proposal done but no approval → iterate or proceed
   - Approved but not implemented → start at Implement
   - Implemented but not verified → start at Verify
   - Verified but not merged → start at Review
   - Merged but deploy not confirmed → run Deploy Gate
   - Deployed but not resolved → start at Resolve
5. **Resume from that phase** and continue to completion.

## Pipeline Phases

### Phase 1: Recon
Pre-condition: if the ticket is a `bug` type, link SOP-121 to the ticket via `ticket_relate_article` before proceeding.
Read ticket, scan codebase, post recon summary comment. No code changes.

### Phase 2: Propose
Post a proposal comment with: what will change, files affected, approach, trade-offs.

### Phase 3: Implement
Implement, commit incrementally to `feat/NNN-<desc>`, push, post implementation comment.

### Phase 4: Verify (pre-merge)
Run linter, tests, walk through every AC. Post verification report. Observable ACs get `DEFER: post-deploy` marker.

### Phase 5: Review
`git diff main...HEAD`, post review with verdict. If APPROVED: merge `--no-ff` and push.

### Phase 5.5: Deploy Gate
Run `gh run list --workflow=deploy.yml --branch=main --limit=1` and wait. PASS → proceed, FAIL → halt and recommend `git revert`.

### Phase 6: Resolve
`sanctum --agent architect ticket resolve <id> -b "<resolution body>"`

### Phase 7: Document
Check KB articles, CLI docs, API guides. Update as needed.

## After completion

Check the handover/milestone for the next ticket. Ask the operator: "Ticket #X resolved. Next up is #Y — continue?"

Reference: SOP-102 — Ticket Delivery Checklist
