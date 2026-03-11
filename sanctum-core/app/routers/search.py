from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, case, literal
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(tags=["Search"])


# ─────────────────────────────────────────────
# SCORING HELPERS
# ─────────────────────────────────────────────

def _best_similarity(term: str, *columns):
    """Return a SQLAlchemy expression for the highest word_similarity across multiple columns."""
    sims = [func.word_similarity(term, col) for col in columns if col is not None]
    if len(sims) == 1:
        return sims[0]
    return func.greatest(*sims)


def _score_result(term: str, result_dict: dict, title_field: str, content_fields: list = None) -> float:
    """
    Calculate a tier-based score for a result.
    Called after the DB query to assign scores based on match type.

    Tiers:
      - exact title match: 0.95
      - ilike title/name: 0.8
      - ilike content/description: 0.6
      - fallback (fuzzy only): uses raw similarity passed in
    """
    term_lower = term.lower()
    title_val = (result_dict.get('_title_raw') or '').lower()

    # Exact title match
    if term_lower == title_val:
        return 0.95

    # Title contains term
    if term_lower in title_val:
        return 0.8

    # Content fields contain term
    if content_fields:
        for field_val in content_fields:
            if field_val and term_lower in field_val.lower():
                return 0.6

    # Fuzzy fallback — use raw similarity score if provided
    raw_sim = result_dict.get('_similarity', 0.3)
    return round(min(raw_sim, 0.55), 3)  # Cap fuzzy below ilike tier


@router.get("/search", response_model=List[schemas.SearchResult])
def global_search(
    q: str,
    limit: int = Query(default=5, ge=1, le=20, description="Max results per entity type"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    q = q.strip()
    if len(q) < 2:
        return []

    q_lower = q.lower()
    results = []

    # ─────────────────────────────────────────
    # 1. ACTION SHORTCUTS (Intent Recognition)
    # ─────────────────────────────────────────
    actions = {
        "new ticket":   {"id": -1,  "type": "action", "title": "Create New Ticket",   "subtitle": "Opens Ticket Editor",      "link": "/tickets/new",    "score": 1.0},
        "new wiki":     {"id": -2,  "type": "action", "title": "Create New Article",   "subtitle": "Add Knowledge Base Entry", "link": "/wiki/new",       "score": 1.0},
        "new client":   {"id": -3,  "type": "action", "title": "Onboard Client",       "subtitle": "Start Onboarding Wizard",  "link": "/clients/new",    "score": 1.0},
        "my profile":   {"id": -4,  "type": "action", "title": "My Profile",           "subtitle": "Manage Account",           "link": "/profile",        "score": 1.0},
        "new project":  {"id": -5,  "type": "action", "title": "Create New Project",   "subtitle": "Start a new project",      "link": "/projects/new",   "score": 1.0},
        "new deal":     {"id": -6,  "type": "action", "title": "Create New Deal",      "subtitle": "Add to pipeline",          "link": "/deals/new",      "score": 1.0},
        "new asset":    {"id": -7,  "type": "action", "title": "Create New Asset",     "subtitle": "Add to CMDB",              "link": "/assets/new",     "score": 1.0},
        "new contact":  {"id": -8,  "type": "action", "title": "Create New Contact",   "subtitle": "Add a contact to a client","link": "/contacts/new",   "score": 1.0},
        "new invoice":  {"id": -9,  "type": "action", "title": "Create New Invoice",   "subtitle": "Draft an invoice",         "link": "/invoices/new",   "score": 1.0},
        "new campaign": {"id": -10, "type": "action", "title": "Create New Campaign",  "subtitle": "Launch a campaign",        "link": "/campaigns/new",  "score": 1.0},
    }

    # Exact Action Match
    if q_lower in actions:
        return [actions[q_lower]]

    # Partial Action Match (e.g. "new")
    if q_lower.startswith("new"):
        for key, action in actions.items():
            if key.startswith(q_lower):
                results.append(action)
        if q_lower == "new ":
            return results

    # ─────────────────────────────────────────
    # 2. PREFIX PARSING (Scope Resolution)
    # ─────────────────────────────────────────
    parts = q.split(' ', 1)
    raw_prefix = parts[0].lower()

    prefix_map = {
        'w:': 'wiki', 'wiki': 'wiki', 'wiki:': 'wiki',
        't:': 'ticket', 'tic': 'ticket', 'ticket': 'ticket', 'ticket:': 'ticket',
        'c:': 'client', 'client': 'client', 'client:': 'client',
        'u:': 'contact', 'user': 'contact', 'contact': 'contact',
        'a:': 'asset', 'asset': 'asset', 'asset:': 'asset',
        'p:': 'project', 'project': 'project', 'project:': 'project',
        'm:': 'milestone', 'milestone': 'milestone', 'milestone:': 'milestone',
        'i:': 'product', 'inventory': 'product', 'catalog': 'product',
    }

    mode = None
    term_str = q

    if raw_prefix in prefix_map or raw_prefix.rstrip(':') in prefix_map:
        if raw_prefix in prefix_map:
            mode = prefix_map[raw_prefix]
        elif raw_prefix + ':' in prefix_map:
            mode = prefix_map[raw_prefix + ':']

        if len(parts) > 1:
            term_str = parts[1]
        elif raw_prefix.endswith(':'):
            term_str = ""
        else:
            mode = None

    term = f"%{term_str}%"

    if len(term_str) < 1 and mode:
        return []

    # In prefix mode, allow higher limits since results are scoped
    effective_limit = limit * 2 if mode else limit

    # ─────────────────────────────────────────
    # 3. EXECUTE SCORED QUERIES
    # ─────────────────────────────────────────

    # --- CLIENTS ---
    if mode in [None, 'client']:
        sim_col = _best_similarity(term_str, models.Account.name)
        acc_query = db.query(models.Account, sim_col.label('sim')).filter(or_(
            models.Account.name.ilike(term),
            func.word_similarity(term_str, models.Account.name) > 0.3
        ))
        if current_user.access_scope == 'nt_only':
            acc_query = acc_query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
        elif current_user.access_scope == 'ds_only':
            acc_query = acc_query.filter(models.Account.brand_affinity.in_(['ds', 'both']))

        for acc, sim in acc_query.order_by(sim_col.desc()).limit(effective_limit).all():
            score = _score_result(term_str, {'_title_raw': acc.name, '_similarity': float(sim)}, 'name')
            results.append({
                "id": acc.id, "type": "client", "title": acc.name,
                "subtitle": acc.type, "link": f"/clients/{acc.id}",
                "score": score
            })

    # --- TICKETS ---
    if mode in [None, 'ticket']:
        # Exact ID Match
        if term_str.isdigit():
            t_exact = db.query(models.Ticket).filter(models.Ticket.id == int(term_str))
            if current_user.role == 'client':
                t_exact = t_exact.filter(models.Ticket.account_id == current_user.account_id)
            t_exact = t_exact.first()

            if t_exact:
                results.append({
                    "id": t_exact.id, "type": "ticket", "title": f"#{t_exact.id} {t_exact.subject}",
                    "subtitle": f"{t_exact.status} • {t_exact.priority}", "link": f"/tickets/{t_exact.id}",
                    "score": 0.95
                })

        # Text Search with scoring
        sim_col = _best_similarity(term_str, models.Ticket.subject, models.Ticket.description)
        tick_query = db.query(models.Ticket, sim_col.label('sim')).filter(or_(
            models.Ticket.subject.ilike(term),
            models.Ticket.description.ilike(term),
            models.Ticket.resolution.ilike(term),
            models.Ticket.id.cast(models.String).ilike(term),
            func.word_similarity(term_str, models.Ticket.subject) > 0.3,
            func.word_similarity(term_str, models.Ticket.description) > 0.3
        ))
        if current_user.role == 'client':
            tick_query = tick_query.filter(models.Ticket.account_id == current_user.account_id)

        for t, sim in tick_query.order_by(sim_col.desc()).limit(effective_limit).all():
            if not any(r['id'] == t.id and r['type'] == 'ticket' for r in results):
                score = _score_result(
                    term_str,
                    {'_title_raw': t.subject, '_similarity': float(sim)},
                    'subject',
                    [t.description, t.resolution]
                )
                results.append({
                    "id": t.id, "type": "ticket", "title": f"#{t.id} {t.subject}",
                    "subtitle": t.status, "link": f"/tickets/{t.id}",
                    "score": score
                })

    # --- CONTACTS ---
    if mode in [None, 'contact'] and current_user.role != 'client':
        full_name_sim = _best_similarity(term_str, models.Contact.first_name, models.Contact.last_name)
        con_query = db.query(models.Contact, full_name_sim.label('sim')).filter(or_(
            models.Contact.first_name.ilike(term),
            models.Contact.last_name.ilike(term),
            models.Contact.email.ilike(term),
            func.word_similarity(term_str, models.Contact.first_name) > 0.3,
            func.word_similarity(term_str, models.Contact.last_name) > 0.3
        ))
        for c, sim in con_query.order_by(full_name_sim.desc()).limit(effective_limit).all():
            score = _score_result(
                term_str,
                {'_title_raw': f"{c.first_name} {c.last_name}", '_similarity': float(sim)},
                'name'
            )
            results.append({
                "id": c.id, "type": "contact", "title": f"{c.first_name} {c.last_name}",
                "subtitle": c.email, "link": f"/clients/{c.account_id}",
                "score": score
            })

    # --- WIKI ---
    if mode in [None, 'wiki'] and current_user.role != 'client':
        sim_col = _best_similarity(term_str, models.Article.title, models.Article.content)
        wiki_query = db.query(models.Article, sim_col.label('sim')).filter(or_(
            models.Article.title.ilike(term),
            models.Article.identifier.ilike(term),
            models.Article.content.ilike(term),
            func.word_similarity(term_str, models.Article.title) > 0.3
        ))
        for w, sim in wiki_query.order_by(sim_col.desc()).limit(effective_limit).all():
            score = _score_result(
                term_str,
                {'_title_raw': w.title, '_similarity': float(sim)},
                'title',
                [w.content]
            )
            # Boost exact identifier match
            if w.identifier and term_str.upper() == w.identifier:
                score = 0.95
            results.append({
                "id": w.id, "type": "wiki", "title": w.title,
                "subtitle": w.identifier, "link": f"/wiki/{w.slug}",
                "score": score
            })

    # --- ASSETS ---
    if mode in [None, 'asset'] and current_user.role != 'client':
        sim_col = _best_similarity(term_str, models.Asset.name)
        asset_query = db.query(models.Asset, sim_col.label('sim')).filter(or_(
            models.Asset.name.ilike(term),
            models.Asset.ip_address.ilike(term),
            models.Asset.serial_number.ilike(term),
            func.word_similarity(term_str, models.Asset.name) > 0.3
        ))
        for a, sim in asset_query.order_by(sim_col.desc()).limit(effective_limit).all():
            score = _score_result(term_str, {'_title_raw': a.name, '_similarity': float(sim)}, 'name')
            results.append({
                "id": a.id, "type": "asset", "title": a.name,
                "subtitle": a.ip_address or a.asset_type,
                "link": f"/assets/{a.id}",
                "score": score
            })

    # --- PROJECTS ---
    if mode in [None, 'project']:
        sim_col = _best_similarity(term_str, models.Project.name)
        proj_query = db.query(models.Project, sim_col.label('sim')).filter(or_(
            models.Project.name.ilike(term),
            func.word_similarity(term_str, models.Project.name) > 0.3
        )).filter(models.Project.is_deleted == False)
        if current_user.role == 'client':
            proj_query = proj_query.filter(models.Project.account_id == current_user.account_id)
        for p, sim in proj_query.order_by(sim_col.desc()).limit(effective_limit).all():
            score = _score_result(term_str, {'_title_raw': p.name, '_similarity': float(sim)}, 'name')
            results.append({
                "id": p.id, "type": "project", "title": p.name,
                "subtitle": p.status, "link": f"/projects/{p.id}",
                "score": score
            })

    # --- MILESTONES ---
    if mode in [None, 'milestone']:
        sim_col = _best_similarity(term_str, models.Milestone.name)
        ms_query = db.query(models.Milestone, sim_col.label('sim')).join(
            models.Project, models.Milestone.project_id == models.Project.id
        ).filter(or_(
            models.Milestone.name.ilike(term),
            func.word_similarity(term_str, models.Milestone.name) > 0.3
        )).filter(models.Project.is_deleted == False)
        if current_user.role == 'client':
            ms_query = ms_query.filter(models.Project.account_id == current_user.account_id)
        for ms, sim in ms_query.order_by(sim_col.desc()).limit(effective_limit).all():
            score = _score_result(term_str, {'_title_raw': ms.name, '_similarity': float(sim)}, 'name')
            results.append({
                "id": ms.id, "type": "milestone", "title": ms.name,
                "subtitle": ms.status, "link": f"/projects/{ms.project_id}",
                "score": score
            })

    # --- PRODUCTS (CATALOG) ---
    if mode in [None, 'product'] and current_user.role != 'client':
        sim_col = _best_similarity(term_str, models.Product.name, models.Product.description)
        prod_query = db.query(models.Product, sim_col.label('sim')).filter(or_(
            models.Product.name.ilike(term),
            models.Product.description.ilike(term),
            func.word_similarity(term_str, models.Product.name) > 0.3
        )).filter(models.Product.is_active == True)
        for p, sim in prod_query.order_by(sim_col.desc()).limit(effective_limit).all():
            score = _score_result(
                term_str,
                {'_title_raw': p.name, '_similarity': float(sim)},
                'name',
                [p.description]
            )
            results.append({
                "id": p.id, "type": "product", "title": p.name,
                "subtitle": p.type, "link": f"/catalog/{p.id}",
                "score": score
            })

    # ─────────────────────────────────────────
    # 4. SORT BY RELEVANCE
    # ─────────────────────────────────────────
    results.sort(key=lambda r: r.get('score', 0), reverse=True)

    return results
