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

    # 1. CLIENTS (Name)
    acc_query = db.query(models.Account).filter(models.Account.name.ilike(term))
    if current_user.access_scope == 'nt_only': acc_query = acc_query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only': acc_query = acc_query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
    
    for acc in acc_query.limit(3).all():
        results.append({
            "id": acc.id, "type": "client", "title": acc.name, 
            "subtitle": acc.type, "link": f"/clients/{acc.id}"
        })

    # 2. TICKETS (Subject OR ID)
    tick_query = db.query(models.Ticket).filter(or_(
        models.Ticket.subject.ilike(term),
        models.Ticket.id.cast(models.String).ilike(term)
    ))
    if current_user.role == 'client': tick_query = tick_query.filter(models.Ticket.account_id == current_user.account_id)
    
    for t in tick_query.limit(5).all():
        results.append({
            "id": t.id, "type": "ticket", "title": f"#{t.id} {t.subject}", 
            "subtitle": t.status, "link": f"/tickets/{t.id}"
        })

    # 3. CONTACTS (Name OR Email)
    if current_user.role != 'client':
        con_query = db.query(models.Contact).filter(or_(
            models.Contact.first_name.ilike(term),
            models.Contact.last_name.ilike(term),
            models.Contact.email.ilike(term)
        ))
        for c in con_query.limit(3).all():
            results.append({
                "id": c.id, "type": "contact", "title": f"{c.first_name} {c.last_name}", 
                "subtitle": c.email, "link": f"/clients/{c.account_id}" 
            })

    # 4. WIKI (Title OR Identifier) - UPDATED
    if current_user.role != 'client':
        wiki_query = db.query(models.Article).filter(or_(
            models.Article.title.ilike(term),
            models.Article.identifier.ilike(term) # <--- NEW
        ))
        for w in wiki_query.limit(5).all():
            results.append({
                "id": w.id, "type": "wiki", "title": w.title, 
                "subtitle": w.identifier, "link": f"/wiki/{w.slug}"
            })

    # 5. ASSETS (Name OR IP OR Serial) - NEW
    if current_user.role != 'client':
        asset_query = db.query(models.Asset).filter(or_(
            models.Asset.name.ilike(term),
            models.Asset.ip_address.ilike(term),
            models.Asset.serial_number.ilike(term)
        ))
        for a in asset_query.limit(5).all():
            results.append({
                "id": a.id, "type": "asset", "title": a.name, 
                "subtitle": a.ip_address or a.asset_type, 
                # Note: We don't have an asset detail page yet, so we go to the Client context
                "link": f"/clients/{a.account_id}" 
            })

    return results
