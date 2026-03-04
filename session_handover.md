# Session Handover — Knowledge Graph Expansion (#310–#317)

## Session Name
Knowledge Graph Expansion — Article & Ticket Relations (#310–#317)

## Completed This Session

### Tickets Resolved
| # | Subject |
|---|---|
| ✅ #310 | Feature: Related articles — knowledge graph (full stack) |
| ✅ #312 | Feature: sanctum.sh article relate/unrelate CLI |
| ✅ #313 | Feature: sanctum.sh ticket article linking CLI |

### Key Deliverables
- `article_relations` bidirectional join table + migration (`fc78ff647823`)
- `POST /articles/{id}/relations` and `DELETE /articles/{id}/relations/{related_id}` endpoints
- `ArticleDetail.jsx` — Related Articles sidebar card (link/unlink, SearchableSelect)
- `PortalArticleView.jsx` — read-only Related Articles section
- `sanctum.sh` — `article relate`, `article unrelate`, `--related` flag on create/update
- `sanctum.sh` — `ticket relate`, `ticket unrelate`, `--articles` flag on create/update
- `resolve_article_identifier` shared helper (identifier → UUID resolution)
- Fixed article relations payload bug (jq-built JSON, commit `e5fd1ef`)
- DOC-001 updated — new Section 4: Linking Articles to Tickets
- DOC-002 updated — new Section 4: Managing Related Articles (knowledge graph standard)
- TPL-001 updated to v1.4 — new Section 7 (sticky UX patterns) + Section 8 (knowledge graph)

### Commits
- `5c41b64` — Backend: article relations
- `102c57d` — ArticleDetail sidebar
- `561830d` — Portal read-only section
- `ea9f2fa` — Fix SearchableSelect selectedIds limit
- `fc42a4b` — sanctum.sh article/ticket relate CLI + help docs
- `e5fd1ef` — Fix article relations payload (jq)

---

## Open Backlog

### Phase 55: UX & Stability
| # | Subject | Type |
|---|---|---|
| #290 | Backend: Review and improve project detail view | feature |
| #291 | Vendors: All vendors list view | feature |
| #295 | Screenshot capture: full page with download option | feature |
| #296 | Accounts: default technician assignment per client | feature |
| #311 | Audit all detail pages against Intelligence Dossier standard | refactor |
| #314 | Bug: Seamless embed style renders as card — hardcoded Tailwind in content_engine.py | bug |
| #315 | UX: Contextual sticky nav + stacked sticky sidebar on detail pages | feature |
| #316 | Bug/UX: ProjectDetail — milestone descriptions not rendered + redesign | feature |

### Phase 68: The Steward v2
| # | Subject | Type |
|---|---|---|
| #293 | Domain expiry warning email | feature |
| #294 | Domain asset: prompt when expiry date missing | feature |

### Phase 73: The Scheduler
| # | Subject | Type |
|---|---|---|
| #307 | Google Calendar synchronization | feature |

### Knowledge Base 2.0
| # | Subject | Type |
|---|---|---|
| #317 | Ticket knowledge graph — typed relations + visibility | feature |

---

## Next Session Focus — #317 + CLI + Docs

### Ticket #317: Ticket Knowledge Graph

**Full scope:**

#### Backend
- New `ticket_relations` join table:
  ```
  ticket_id       UUID FK → tickets.id
  related_id      UUID FK → tickets.id
  relation_type   ENUM: relates_to | blocks | duplicates
  visibility      ENUM: internal | public (default: internal)
  PRIMARY KEY (ticket_id, related_id)
  ```
- Alembic migration
- `POST /tickets/{id}/relations` — body: `{related_id, relation_type, visibility}`
- `DELETE /tickets/{id}/relations/{related_id}`
- `GET /tickets/{id}` — include `related_tickets` in response
- `PortalTicketView` — only expose `public` visibility relations

#### Frontend — TicketDetail.jsx (Admin)
- Related Tickets card in **main content area**, above Linked Knowledge Articles card
- Shows relation type badge + visibility indicator per linked ticket
- SearchableSelect to link tickets — same pattern as ArticleDetail Related Articles
- Unlink on hover (×)
- Relation type selector: `relates_to` | `blocks` | `duplicates`
- Visibility toggle: `internal` | `public`

#### Frontend — Portal
- Read-only, only `public` relations visible
- Plain language labels: "Related", "Blocked by", "Duplicate of"

#### CLI — sanctum.sh
- `ticket relate {id} --tickets {id1,id2,...} [--type relates_to] [--visibility internal]`
- `ticket unrelate {id} --ticket {id1}` (note: conflicts with existing `--article` unrelate — use `--ticket` flag)
- `--tickets` flag on `ticket create` and `ticket update`
- `--help` docs updated for ticket domain

#### Documentation
- DOC-001 (API Guide: Tickets) — new section: Ticket Relations (knowledge graph)

### Key Architectural Notes
- Bidirectional: store once, query both directions (same as `article_relations`)
- `relation_type` and `visibility` stored on the relation row
- Reverse direction: when A blocks B, B is "blocked by" A — derive label from direction
- Portal visibility: filter `related_tickets` by `visibility = 'public'` in portal endpoint
- CLI uses `resolve_ticket_id` helper (tickets use integer IDs not identifiers, so no resolution needed — pass directly)

### Files to Touch
**Backend:**
- `sanctum-core/app/models.py`
- `sanctum-core/app/schemas/tickets.py`
- `sanctum-core/app/schemas/__init__.py`
- `sanctum-core/app/routers/tickets.py`
- `sanctum-core/app/routers/portal.py`
- `sanctum-core/alembic/versions/` (new migration)

**Frontend:**
- `sanctum-web/src/pages/TicketDetail.jsx`
- `sanctum-web/src/pages/PortalTicketView.jsx` (confirm exists)

**CLI:**
- `scripts/dev/sanctum.sh`

**KB:**
- DOC-001 — API Guide: Tickets

### Reference
- `article_relations` pattern: `sanctum-core/app/models.py`, `sanctum-core/app/routers/wiki.py`
- `ArticleDetail.jsx` Related Articles sidebar — reference for SearchableSelect link/unlink pattern
- `PortalArticleView.jsx` — reference for portal read-only relations
- Auth: `$SANCTUM_API_TOKEN` (sntm_6f29146...)
- Environment: Production
- Workflow: Surgical Reconnaissance — recon before patching

---

## Standards & Conventions

### KB Article Rules (established this session)
- Never include a manually typed `## Related` section in article content
- Relations managed exclusively via sidebar UI or `sanctum.sh article relate`
- Always use `--articles` / `--related` flags when creating/updating tickets and articles that reference other docs

### sanctum.sh Patterns
- `resolve_article_identifier` helper resolves `DOC-012` style identifiers to UUIDs
- Ticket IDs are integers — passed directly, no resolution needed
- All relation payloads must use `jq -n --arg` to build JSON safely (raw string interpolation breaks)
- `api_post` passes `$2` directly to curl `-d` — malformed JSON silently fails with API error

