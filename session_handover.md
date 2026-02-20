# SESSION HANDOVER — 2026-02-20

## 0. WHAT WE ACCOMPLISHED

### Ticket #189 — The Blueprint (Governance) ✅
- ✅ Created `create_milestone.sh` v1.0 — new CLI milestone creator
- ✅ Created milestone *Phase 64: The Blueprint* (`3da65428-7634-4068-89e6-536e5d37fcfe`) under project `335650e8-1a85-4263-9a25-4cf2ca55fb79` (Sanctum Core v1.x)
- ✅ Created Ticket #189 — `#16 Project Templates — The Blueprint` (feature, high priority, linked to milestone)

### Ticket #187 — Refactor Legacy Tables to Unified Component ✅
- ✅ Posted internal resolution comment (work summary in markdown)
- ✅ Marked ticket #187 as resolved via API

### Script Infrastructure Hardening ✅
- ✅ `create_ticket.sh` — added `--project-id` flag to bypass fuzzy project name resolution
- ✅ `create_ticket.sh` — auto-fetches `account_id` from project when `--project-id` is used
- ✅ `create_ticket.sh` — fixed validation guard to accept `--project-id`
- ✅ `sanctum_common.sh` — auth health check now uses protected `GET /projects` (HTTP 200 check) instead of public `GET /` (was silently passing expired/invalid tokens)
- ✅ `api_test.sh` — now prefers `SANCTUM_API_TOKEN` over saved JWT token file

## 1. CURRENT STATE

### Production
- **App:** https://app.digitalsanctum.com.au
- **API:** https://core.digitalsanctum.com.au/api
- **Swagger:** https://core.digitalsanctum.com.au/api/docs

### Git
- **Branch:** main
- **Clean working tree** (all committed and pushed)

### Database
- **New milestone:** Phase 64: The Blueprint (`3da65428-7634-4068-89e6-536e5d37fcfe`)
  - Project: Sanctum Core v1.x (`335650e8-1a85-4263-9a25-4cf2ca55fb79`)
  - Sequence: 1, Status: pending

### Active Tickets
- **#189** — `#16 Project Templates — The Blueprint` (feature, high, new) — **NEXT SPRINT**
- **#187** — Resolved ✅

### Files Modified This Session
```
scripts/dev/create_milestone.sh   (NEW — CLI milestone creator v1.0)
scripts/dev/create_ticket.sh      (--project-id flag + account resolution fix)
scripts/dev/api_test.sh           (SANCTUM_API_TOKEN priority)
scripts/lib/sanctum_common.sh     (protected endpoint health check)
```

## 2. KNOWN ISSUES / TECH DEBT

- **`api_test.sh` env flag:** Does not support `-e dev|prod` — uses `API_BASE` env var instead. Inconsistent with `create_ticket.sh` and `create_milestone.sh`. Could unify in a future QoL pass.
- **`create_milestone.sh`** — no `--project-name` fuzzy resolution yet (only accepts `--project-id`). Intentional for now but worth adding for consistency.
- **`sanctum_common.sh` `resolve_project()`** — still fails in prod if the API returns unexpected shape. Root cause: `GET /projects` may return a non-array on auth failure. The new 200-check mitigates this but `resolve_project` itself could be more defensive.

## 3. NEXT SPRINT — The Blueprint (Ticket #189)

### Feature Summary
Build a reusable project template engine. Staff define blueprints (milestones + ticket stubs). When creating a project, select a template to auto-scaffold the full structure in one click. Templates can be duplicated to create variants.

### First Template to Seed
**Website Rebuild — Existing Site → 11ty**
| # | Milestone | Tickets |
|---|-----------|---------|
| 1 | Discovery & Scoping | Initial consult call, Content audit, Sitemap planning |
| 2 | Design & Wireframes | Lo-fi wireframes, Client review, Design sign-off |
| 3 | 11ty Development | Scaffold & repo, Build core pages, CMS config |
| 4 | Content Migration | Copy migration, Image optimisation, SEO metadata |
| 5 | QA & Client Review | Cross-browser testing, Client walkthrough, Amendments |
| 6 | Launch & Handover | DNS cutover, Smoke test, Handover docs |

### Suggested Implementation Order

#### Phase A — Backend
1. New models: `ProjectTemplate`, `TemplateMilestone`, `TemplateTicket`
2. Alembic `--autogenerate` migration
3. Router: `GET/POST /project-templates`
4. Router: `GET/PUT/DELETE /project-templates/{id}`
5. Router: `POST /project-templates/{id}/duplicate`
6. Router: `POST /project-templates/{id}/apply` — atomically creates project + milestones + tickets for a given `account_id`
7. Seed script for the 11ty template

#### Phase B — Frontend
1. `ProjectTemplates.jsx` — dashboard, card grid, category badge, milestone/ticket counts
2. `ProjectTemplateDetail.jsx` — inline edit milestones + nested ticket stubs
3. Duplicate button — clone template, prompt for new name
4. Apply Template modal — triggered from project creation, selects template + account

### Suggested Data Model
```python
class ProjectTemplate(Base):
    __tablename__ = "project_templates"
    id = Column(UUID, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String, default="general")  # e.g. "web", "infrastructure", "audit"
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP)
    milestones = relationship("TemplateMilestone", cascade="all, delete-orphan")

class TemplateMilestone(Base):
    __tablename__ = "template_milestones"
    id = Column(UUID, primary_key=True)
    template_id = Column(UUID, ForeignKey("project_templates.id"))
    name = Column(String, nullable=False)
    sequence = Column(Integer, default=1)
    tickets = relationship("TemplateTicket", cascade="all, delete-orphan")

class TemplateTicket(Base):
    __tablename__ = "template_tickets"
    id = Column(UUID, primary_key=True)
    milestone_id = Column(UUID, ForeignKey("template_milestones.id"))
    subject = Column(String, nullable=False)
    ticket_type = Column(String, default="task")
    priority = Column(String, default="normal")
    description = Column(Text)
```

## 4. IMPORTANT NOTES FOR NEXT AI SESSION

- **Auth:** `export SANCTUM_API_TOKEN=sntm_...` — mandatory, do not use saved JWT
- **Delivery:** Surgical recon (grep/sed → cat -A → Python for multi-line). Never sed for multi-line.
- **Patching:** Always confirm all patches ✅ before giving next command
- **Migration:** Always use `alembic revision --autogenerate` — never draft manually
- **API prefix:** `https://core.digitalsanctum.com.au/api` (note `/api` prefix in prod)
- **Project ID:** Sanctum Core v1.x = `335650e8-1a85-4263-9a25-4cf2ca55fb79`
- **Blueprint milestone ID:** `3da65428-7634-4068-89e6-536e5d37fcfe`
- **Ticket #189** is the active governance ticket for this sprint
- **UI pattern:** New pages follow Intelligence Dossier pattern — reference `AssetDetail.jsx`
- **Layout props:** `onRefresh` and `onCopyMeta` are opt-in — wire them up on new detail pages

## 5. COMMANDS FOR NEXT SESSION

```bash
# Start local dev
cd ~/Dev/DigitalSanctum/sanctum-core && source ../venv/bin/activate && uvicorn app.main:app --reload
cd ~/Dev/DigitalSanctum/sanctum-web && npm run dev

# Auth
export SANCTUM_API_TOKEN=sntm_your_token

# Recon for The Blueprint — models
grep -n "class Project\|class Milestone\|class Ticket" ~/Dev/DigitalSanctum/sanctum-core/app/models.py

# Recon for The Blueprint — router
grep -n "^@router" ~/Dev/DigitalSanctum/sanctum-core/app/routers/projects.py

# Recon for The Blueprint — schemas
grep -n "class.*Create\|class.*Response" ~/Dev/DigitalSanctum/sanctum-core/app/schemas/operations.py

# After adding models, run migration
cd sanctum-core
alembic revision --autogenerate -m "add_project_templates"
alembic upgrade head

# Create tickets for sub-tasks if needed
./scripts/dev/create_ticket.sh -e prod \
  --project-id 335650e8-1a85-4263-9a25-4cf2ca55fb79 \
  -m "Phase 64: The Blueprint" \
  --type feature -s "Your subject"
```
