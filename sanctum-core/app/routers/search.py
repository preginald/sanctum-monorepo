from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(tags=["Search"])

@router.get("/search", response_model=List[schemas.SearchResult])
def global_search(q: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    q = q.strip()
    if len(q) < 2: return []
    
    q_lower = q.lower()
    results = []

    # 1. ACTION SHORTCUTS (Intent Recognition)
    # FIX: Use Negative Integers for IDs to satisfy Pydantic Schema (int | UUID)
    actions = {
        "new ticket": {"id": -1, "type": "action", "title": "Create New Ticket", "subtitle": "Opens Ticket Editor", "link": "/tickets/new"},
        "new wiki":   {"id": -2, "type": "action", "title": "Create New Article", "subtitle": "Add Knowledge Base Entry", "link": "/wiki/new"},
        "new client": {"id": -3, "type": "action", "title": "Onboard Client", "subtitle": "Start Onboarding Wizard", "link": "/clients/new"},
        "my profile": {"id": -4, "type": "action", "title": "My Profile", "subtitle": "Manage Account", "link": "/profile"},
    }
    
    # Exact Action Match
    if q_lower in actions:
        return [actions[q_lower]]
        
    # Partial Action Match (e.g. "new")
    if q_lower.startswith("new"):
        for key, action in actions.items():
            if key.startswith(q_lower):
                results.append(action)
        
        # If the user typed exactly "new ", return just the available actions to avoid clutter
        if q_lower == "new ": 
            return results

    # 2. PREFIX PARSING (Scope Resolution)
    parts = q.split(' ', 1)
    raw_prefix = parts[0].lower()
    
    # Map prefixes to Modes
    prefix_map = {
        'w:': 'wiki', 'wiki': 'wiki', 'wiki:': 'wiki',
        't:': 'ticket', 'tic': 'ticket', 'ticket': 'ticket', 'ticket:': 'ticket',
        'c:': 'client', 'client': 'client', 'client:': 'client',
        'u:': 'contact', 'user': 'contact', 'contact': 'contact',
        'a:': 'asset', 'asset': 'asset', 'asset:': 'asset',
        'p:': 'project', 'project': 'project', 'project:': 'project',
        'm:': 'milestone', 'milestone': 'milestone', 'milestone:': 'milestone',
        'i:': 'product', 'inventory': 'product', 'catalog': 'product'
    }
    
    mode = None
    term_str = q
    
    # Check if first token is a prefix
    if raw_prefix in prefix_map or raw_prefix.rstrip(':') in prefix_map:
        # Resolve clean key (handle "w" vs "w:")
        clean_key = raw_prefix if raw_prefix in prefix_map else raw_prefix.rstrip(':')
        
        # Determine Mode
        if raw_prefix in prefix_map:
             mode = prefix_map[raw_prefix]
        elif raw_prefix + ':' in prefix_map:
             mode = prefix_map[raw_prefix + ':']
        
        # Parse Term
        if len(parts) > 1:
            term_str = parts[1] # "w: login" -> "login"
        elif raw_prefix.endswith(':'):
            term_str = "" # "w:" -> ""
        else:
            mode = None # "wiki" -> Search for word "wiki" (no mode)

    term = f"%{term_str}%"
    
    # If mode is active but term is empty (e.g. "w:"), return empty list to wait for input
    if len(term_str) < 1 and mode: return []

    # 3. EXECUTE SCOPED QUERIES
    
    # --- CLIENTS ---
    if mode in [None, 'client']:
        acc_query = db.query(models.Account).filter(or_(
            models.Account.name.ilike(term),
            func.word_similarity(term_str, models.Account.name) > 0.3
        ))
        if current_user.access_scope == 'nt_only': acc_query = acc_query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
        elif current_user.access_scope == 'ds_only': acc_query = acc_query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
        
        for acc in acc_query.limit(3).all():
            results.append({
                "id": acc.id, "type": "client", "title": acc.name, 
                "subtitle": acc.type, "link": f"/clients/{acc.id}"
            })

    # --- TICKETS ---
    if mode in [None, 'ticket']:
        # OPTIMIZATION: Exact ID Match
        if term_str.isdigit():
            t_exact = db.query(models.Ticket).filter(models.Ticket.id == int(term_str))
            if current_user.role == 'client': t_exact = t_exact.filter(models.Ticket.account_id == current_user.account_id)
            t_exact = t_exact.first()
            
            if t_exact:
                results.append({
                    "id": t_exact.id, "type": "ticket", "title": f"#{t_exact.id} {t_exact.subject}", 
                    "subtitle": f"{t_exact.status} • {t_exact.priority}", "link": f"/tickets/{t_exact.id}"
                })

        # Standard Text Search
        tick_query = db.query(models.Ticket).filter(or_(
            models.Ticket.subject.ilike(term),
            models.Ticket.description.ilike(term),
            models.Ticket.resolution.ilike(term),
            models.Ticket.id.cast(models.String).ilike(term),
            func.word_similarity(term_str, models.Ticket.subject) > 0.3,
            func.word_similarity(term_str, models.Ticket.description) > 0.3
        ))
        if current_user.role == 'client': tick_query = tick_query.filter(models.Ticket.account_id == current_user.account_id)
        
        for t in tick_query.limit(5).all():
            # Dedup exact match
            if not any(r['id'] == t.id and r['type'] == 'ticket' for r in results):
                results.append({
                    "id": t.id, "type": "ticket", "title": f"#{t.id} {t.subject}", 
                    "subtitle": t.status, "link": f"/tickets/{t.id}"
                })

    # --- CONTACTS ---
    if mode in [None, 'contact'] and current_user.role != 'client':
        con_query = db.query(models.Contact).filter(or_(
            models.Contact.first_name.ilike(term),
            models.Contact.last_name.ilike(term),
            models.Contact.email.ilike(term),
            func.word_similarity(term_str, models.Contact.first_name) > 0.3,
            func.word_similarity(term_str, models.Contact.last_name) > 0.3
        ))
        for c in con_query.limit(3).all():
            results.append({
                "id": c.id, "type": "contact", "title": f"{c.first_name} {c.last_name}", 
                "subtitle": c.email, "link": f"/clients/{c.account_id}" 
            })

    # --- WIKI ---
    if mode in [None, 'wiki'] and current_user.role != 'client':
        wiki_query = db.query(models.Article).filter(or_(
            models.Article.title.ilike(term),
            models.Article.identifier.ilike(term),
            models.Article.content.ilike(term),
            func.word_similarity(term_str, models.Article.title) > 0.3
        ))
        for w in wiki_query.limit(5).all():
            results.append({
                "id": w.id, "type": "wiki", "title": w.title, 
                "subtitle": w.identifier, "link": f"/wiki/{w.slug}"
            })

    # --- ASSETS ---
    if mode in [None, 'asset'] and current_user.role != 'client':
        asset_query = db.query(models.Asset).filter(or_(
            models.Asset.name.ilike(term),
            models.Asset.ip_address.ilike(term),
            models.Asset.serial_number.ilike(term),
            func.word_similarity(term_str, models.Asset.name) > 0.3
        ))
        for a in asset_query.limit(5).all():
            results.append({
                "id": a.id, "type": "asset", "title": a.name, 
                "subtitle": a.ip_address or a.asset_type, 
                "link": f"/clients/{a.account_id}" 
            })

    # --- PROJECTS ---
    if mode in [None, 'project']:
        proj_query = db.query(models.Project).filter(or_(
            models.Project.name.ilike(term),
            func.word_similarity(term_str, models.Project.name) > 0.3
        )).filter(models.Project.is_deleted == False)
        if current_user.role == 'client':
            proj_query = proj_query.filter(models.Project.account_id == current_user.account_id)
        for p in proj_query.limit(3).all():
            results.append({
                "id": p.id, "type": "project", "title": p.name,
                "subtitle": p.status, "link": f"/projects/{p.id}"
            })

    # --- MILESTONES ---
    if mode in [None, 'milestone']:
        ms_query = db.query(models.Milestone).join(
            models.Project, models.Milestone.project_id == models.Project.id
        ).filter(or_(
            models.Milestone.name.ilike(term),
            func.word_similarity(term_str, models.Milestone.name) > 0.3
        )).filter(models.Project.is_deleted == False)
        if current_user.role == 'client':
            ms_query = ms_query.filter(models.Project.account_id == current_user.account_id)
        for ms in ms_query.limit(3).all():
            results.append({
                "id": ms.id, "type": "milestone", "title": ms.name,
                "subtitle": ms.status, "link": f"/projects/{ms.project_id}"
            })

    # --- PRODUCTS (CATALOG) ---
    if mode in [None, 'product'] and current_user.role != 'client':
        prod_query = db.query(models.Product).filter(or_(
            models.Product.name.ilike(term),
            models.Product.description.ilike(term),
            func.word_similarity(term_str, models.Product.name) > 0.3
        )).filter(models.Product.is_active == True)
        for p in prod_query.limit(3).all():
            results.append({
                "id": p.id, "type": "product", "title": p.name,
                "subtitle": p.type, "link": f"/catalog/{p.id}"
            })

    return results