from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db
from ..services.event_bus import event_bus 
from ..services.notification_service import notification_service

router = APIRouter(prefix="/tickets", tags=["Tickets"])

@router.get("", response_model=List[schemas.TicketResponse])
def get_tickets(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Ticket)\
        .join(models.Account)\
        .options(
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.user),
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.product),
            joinedload(models.Ticket.materials).joinedload(models.TicketMaterial.product),
            joinedload(models.Ticket.milestone).joinedload(models.Milestone.project),
            joinedload(models.Ticket.contacts),
            joinedload(models.Ticket.articles),
            joinedload(models.Ticket.assets) 
        )\
        .filter(models.Ticket.is_deleted == False)

    if current_user.access_scope == 'nt_only':
        query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only':
        query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
    
    if current_user.role == 'client':
        query = query.filter(models.Ticket.account_id == current_user.account_id)

    tickets = query.order_by(models.Ticket.id.desc()).all()
    
    # Enrichment
    results = []
    for t in tickets:
        t_dict = t.__dict__.copy() 
        t_dict['account_name'] = t.account.name
        t_dict['contacts'] = t.contacts 
        t_dict['total_hours'] = t.total_hours
        t_dict['time_entries'] = t.time_entries 
        t_dict['materials'] = t.materials 
        t_dict['articles'] = t.articles
        t_dict['assets'] = t.assets 
        
        if t.milestone:
            t_dict['milestone_name'] = t.milestone.name
            if t.milestone.project:
                t_dict['project_id'] = t.milestone.project.id
                t_dict['project_name'] = t.milestone.project.name
        
        linked_items = db.query(models.InvoiceItem).options(joinedload(models.InvoiceItem.invoice))\
            .filter(models.InvoiceItem.ticket_id == t.id).all()
        unique_invoices = {}
        for item in linked_items:
            if item.invoice: unique_invoices[item.invoice.id] = item.invoice
        t_dict['related_invoices'] = list(unique_invoices.values())
            
        results.append(t_dict)
    return results

@router.post("", response_model=schemas.TicketResponse)
def create_ticket(
    ticket: schemas.TicketCreate, 
    background_tasks: BackgroundTasks, 
    current_user: models.User = Depends(auth.get_current_active_user), 
    db: Session = Depends(get_db)
):
    target_account_id = ticket.account_id
    if current_user.role == 'client':
        target_account_id = current_user.account_id
        ticket.assigned_tech_id = None
        ticket.milestone_id = None
        if not ticket.ticket_type: ticket.ticket_type = 'support'
        
        linked_contact = db.query(models.Contact).filter(models.Contact.account_id == current_user.account_id, models.Contact.email == current_user.email).first()
        if linked_contact and linked_contact.id not in ticket.contact_ids:
            ticket.contact_ids.append(linked_contact.id)

    new_ticket = models.Ticket(
        account_id=target_account_id, subject=ticket.subject, description=ticket.description,
        priority=ticket.priority, status='new', assigned_tech_id=ticket.assigned_tech_id,
        ticket_type=ticket.ticket_type, milestone_id=ticket.milestone_id
    )

    if ticket.contact_ids: 
        new_ticket.contacts = db.query(models.Contact).filter(models.Contact.id.in_(ticket.contact_ids)).all()
        
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    new_ticket.account = db.query(models.Account).filter(models.Account.id == target_account_id).first()
    new_ticket.account_name = new_ticket.account.name 
    
    event_bus.emit("ticket_created", new_ticket, background_tasks)
    
    if new_ticket.assigned_tech_id:
        tech = db.query(models.User).filter(models.User.id == new_ticket.assigned_tech_id).first()
        if tech:
            notification_service.notify(
                db, tech,
                title=f"New Assignment: #{new_ticket.id}",
                message=f"You have been assigned to: {new_ticket.subject} ({new_ticket.account_name})",
                link=f"/tickets/{new_ticket.id}",
                priority=new_ticket.priority,
                event_type="ticket_assigned"
            )
    
    return new_ticket

@router.put("/{ticket_id}", response_model=schemas.TicketResponse)
def update_ticket(
    ticket_id: int, 
    ticket_update: schemas.TicketUpdate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    ticket = db.query(models.Ticket).options(joinedload(models.Ticket.contacts)).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")
    update_data = ticket_update.model_dump(exclude_unset=True)

    was_resolved = ticket.status == 'resolved'
    old_tech_id = ticket.assigned_tech_id

    # 1. HANDLE MANY-TO-MANY CONTACTS
    if 'contact_ids' in update_data:
        ids = update_data.pop('contact_ids') # Remove from dict so setattr doesn't crash
        # Replace the entire collection with new list
        if ids:
            ticket.contacts = db.query(models.Contact).filter(models.Contact.id.in_(ids)).all()
        else:
            ticket.contacts = []

    # 2. STATUS CHECK
    if 'status' in update_data and update_data['status'] == 'resolved' and ticket.status != 'resolved':
        if 'closed_at' not in update_data: ticket.closed_at = func.now()
    
    # 3. GENERIC FIELDS
    for key, value in update_data.items(): setattr(ticket, key, value)
    
    db.commit()
    db.refresh(ticket)
    ticket.account_name = ticket.account.name

    # 4. NOTIFY: ASSIGNMENT CHANGE
    if ticket.assigned_tech_id and ticket.assigned_tech_id != old_tech_id:
        tech = db.query(models.User).filter(models.User.id == ticket.assigned_tech_id).first()
        if tech:
            notification_service.notify(
                db, tech,
                title=f"Assignment Update: #{ticket.id}",
                message=f"You have been assigned to ticket: {ticket.subject}",
                link=f"/tickets/{ticket.id}",
                priority=ticket.priority,
                event_type="ticket_assigned"
            )

    # 5. NOTIFY: RESOLUTION
    if ticket.status == 'resolved' and not was_resolved:
        event_bus.emit("ticket_resolved", ticket, background_tasks)
        # Note: The NotificationRouter in EventBus will now handle notifying ALL contacts
        # so we don't need manual notification logic here anymore.

    return ticket

@router.delete("/{ticket_id}")
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    tick = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not tick: raise HTTPException(status_code=404, detail="Ticket not found")
    tick.is_deleted = True
    db.commit()
    return {"status": "archived"}

# --- SUB-ITEMS (Time/Material/Links) ---

@router.post("/{ticket_id}/time_entries", response_model=schemas.TimeEntryResponse)
def create_time_entry(ticket_id: int, entry: schemas.TimeEntryCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")
    new_entry = models.TicketTimeEntry(
        ticket_id=ticket_id, user_id=current_user.id, start_time=entry.start_time, end_time=entry.end_time, description=entry.description, product_id=entry.product_id
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    new_entry.user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if entry.product_id: new_entry.product = db.query(models.Product).filter(models.Product.id == entry.product_id).first()
    return new_entry

@router.put("/time_entries/{entry_id}", response_model=schemas.TimeEntryResponse)
def update_time_entry(entry_id: str, update: schemas.TimeEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.id == entry_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Entry not found")
    if update.start_time: entry.start_time = update.start_time
    if update.end_time: entry.end_time = update.end_time
    if update.description is not None: entry.description = update.description
    if update.product_id: entry.product_id = update.product_id
    db.commit()
    db.refresh(entry)
    return entry

@router.delete("/{ticket_id}/time_entries/{entry_id}")
def delete_time_entry(ticket_id: int, entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.id == entry_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"status": "deleted"}

@router.post("/time_entries/{entry_id}/duplicate", response_model=schemas.TimeEntryResponse)
def duplicate_time_entry(entry_id: str, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    original = db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.id == entry_id).first()
    if not original: raise HTTPException(status_code=404, detail="Entry not found")
    new_entry = models.TicketTimeEntry(
        ticket_id=original.ticket_id, user_id=current_user.id, product_id=original.product_id,
        start_time=original.start_time, end_time=original.end_time, description=original.description
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    new_entry.user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if new_entry.product_id: new_entry.product = db.query(models.Product).filter(models.Product.id == new_entry.product_id).first()
    return new_entry

@router.post("/{ticket_id}/materials", response_model=schemas.TicketMaterialResponse)
def add_ticket_material(ticket_id: int, material: schemas.TicketMaterialCreate, db: Session = Depends(get_db)):
    new_mat = models.TicketMaterial(ticket_id=ticket_id, product_id=material.product_id, quantity=material.quantity)
    db.add(new_mat)
    db.commit()
    db.refresh(new_mat)
    new_mat.product = db.query(models.Product).filter(models.Product.id == material.product_id).first()
    return new_mat

@router.put("/materials/{material_id}", response_model=schemas.TicketMaterialResponse)
def update_ticket_material(material_id: str, update: schemas.TicketMaterialUpdate, db: Session = Depends(get_db)):
    mat = db.query(models.TicketMaterial).filter(models.TicketMaterial.id == material_id).first()
    if not mat: raise HTTPException(status_code=404, detail="Material not found")
    if update.quantity is not None: mat.quantity = update.quantity
    if update.product_id: mat.product_id = update.product_id
    db.commit()
    db.refresh(mat)
    return mat

@router.delete("/{ticket_id}/materials/{material_id}")
def delete_ticket_material(ticket_id: int, material_id: str, db: Session = Depends(get_db)):
    mat = db.query(models.TicketMaterial).filter(models.TicketMaterial.id == material_id).first()
    if not mat: raise HTTPException(status_code=404, detail="Material not found")
    db.delete(mat)
    db.commit()
    return {"status": "deleted"}

@router.post("/{ticket_id}/articles/{article_id}")
def link_article_to_ticket(ticket_id: int, article_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not ticket or not article: raise HTTPException(status_code=404, detail="Not found")
    if article not in ticket.articles:
        ticket.articles.append(article)
        db.commit()
    return {"status": "linked"}

@router.delete("/{ticket_id}/articles/{article_id}")
def unlink_article_from_ticket(ticket_id: int, article_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not ticket or not article: raise HTTPException(status_code=404, detail="Not found")
    if article in ticket.articles:
        ticket.articles.remove(article)
        db.commit()
    return {"status": "unlinked"}

@router.post("/{ticket_id}/assets/{asset_id}")
def link_asset_to_ticket(ticket_id: int, asset_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not ticket or not asset: raise HTTPException(status_code=404, detail="Not found")
    if ticket.account_id != asset.account_id:
        raise HTTPException(status_code=400, detail="Asset belongs to different account")
    if asset not in ticket.assets:
        ticket.assets.append(asset)
        db.commit()
    return {"status": "linked"}

@router.delete("/{ticket_id}/assets/{asset_id}")
def unlink_asset_from_ticket(ticket_id: int, asset_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not ticket or not asset: raise HTTPException(status_code=404, detail="Not found")
    if asset in ticket.assets:
        ticket.assets.remove(asset)
        db.commit()
    return {"status": "unlinked"}