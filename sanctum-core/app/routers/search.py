from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(tags=["Search"])

@router.get("/search", response_model=List[schemas.SearchResult])
def global_search(q: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    if len(q) < 2: return []
    
    term = f"%{q}%"
    results = []

    # 1. CLIENTS (Accounts)
    # Scope check
    acc_query = db.query(models.Account).filter(models.Account.name.ilike(term))
    if current_user.access_scope == 'nt_only': acc_query = acc_query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only': acc_query = acc_query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
    
    for acc in acc_query.limit(5).all():
        results.append({
            "id": acc.id, "type": "client", "title": acc.name, 
            "subtitle": acc.type, "link": f"/clients/{acc.id}"
        })

    # 2. TICKETS
    # Search subject or stringified ID
    tick_query = db.query(models.Ticket).filter(or_(
        models.Ticket.subject.ilike(term),
        models.Ticket.id.cast(models.String).ilike(term)
    ))
    # Scope check (simple version via Account join if needed, but simplistic here for speed)
    if current_user.role == 'client': tick_query = tick_query.filter(models.Ticket.account_id == current_user.account_id)
    
    for t in tick_query.limit(5).all():
        results.append({
            "id": t.id, "type": "ticket", "title": f"#{t.id} {t.subject}", 
            "subtitle": t.status, "link": f"/tickets/{t.id}"
        })

    # 3. CONTACTS
    if current_user.role != 'client':
        con_query = db.query(models.Contact).filter(or_(
            models.Contact.first_name.ilike(term),
            models.Contact.last_name.ilike(term),
            models.Contact.email.ilike(term)
        ))
        for c in con_query.limit(5).all():
            results.append({
                "id": c.id, "type": "contact", "title": f"{c.first_name} {c.last_name}", 
                "subtitle": c.email, "link": f"/clients/{c.account_id}" # Go to client page
            })

    # 4. WIKI
    if current_user.role != 'client':
        wiki_query = db.query(models.Article).filter(models.Article.title.ilike(term))
        for w in wiki_query.limit(5).all():
            results.append({
                "id": w.id, "type": "wiki", "title": w.title, 
                "subtitle": w.identifier, "link": f"/wiki/{w.slug}"
            })

    return results