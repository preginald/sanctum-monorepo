from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, func, desc
from datetime import timedelta, datetime
from pydantic import BaseModel

from .database import get_db
from . import models, schemas, auth

import os
from .services import pdf_engine
from typing import List, Optional

from .services.email_service import email_service # <--- NEW IMPORT
from .services.pdf_engine import pdf_engine

app = FastAPI(title="Sanctum Core", version="1.5.2")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def recalculate_invoice(invoice_id: str, db: Session):
    """Refreshes the Subtotal, GST, and Total based on current items."""
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice: return

    # 1. Sum Items
    subtotal = 0.0
    for item in invoice.items:
        # Ensure item total is correct first
        item.total = round(item.quantity * item.unit_price, 2)
        subtotal += item.total
    
    # 2. Calculate Tax
    gst = round(subtotal * 0.10, 2) # AU GST 10%
    total = round(subtotal + gst, 2)

    # 3. Save
    invoice.subtotal_amount = subtotal
    invoice.gst_amount = gst
    invoice.total_amount = total
    invoice.generated_at = func.now() # Touch timestamp
    db.commit()
    db.refresh(invoice)
    return invoice


# --- AUTH & DASHBOARD ---
@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # CRITICAL FIX: Include ROLE and ACCOUNT_ID in the token
    token_payload = {
        "sub": user.email, 
        "scope": user.access_scope,
        "role": user.role,           # <--- This fixes the Buttons
        "id": str(user.id),
        "account_id": str(user.account_id) if user.account_id else None
    }
    
    access_token = auth.create_access_token(
        data=token_payload,
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/refresh", response_model=schemas.Token)
def refresh_session(
    current_user: models.User = Depends(auth.get_current_active_user)
):
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # CRITICAL FIX: Include ROLE in refresh too
    token_payload = {
        "sub": current_user.email, 
        "scope": current_user.access_scope,
        "role": current_user.role,   # <--- Fix
        "id": str(current_user.id),
        "account_id": str(current_user.account_id) if current_user.account_id else None
    }

    access_token = auth.create_access_token(
        data=token_payload,
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- 1. SECURE ACCOUNTS LIST ---
@app.get("/accounts", response_model=List[schemas.AccountResponse])
def get_accounts(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Account)
    
    # SECURITY PATCH: Clients only see themselves
    if current_user.role == 'client':
        query = query.filter(models.Account.id == current_user.account_id)
    
    # Existing Staff Filters
    elif current_user.access_scope == 'ds_only':
        query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
    elif current_user.access_scope == 'nt_only':
        query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
        
    return query.all()

@app.get("/accounts/{account_id}", response_model=schemas.AccountDetail)
def get_account_detail(account_id: str, db: Session = Depends(get_db)):
    account = db.query(models.Account)\
        .options(joinedload(models.Account.contacts))\
        .options(joinedload(models.Account.deals))\
        .options(joinedload(models.Account.projects))\
        .options(joinedload(models.Account.invoices))\
        .options(
            joinedload(models.Account.tickets)
            .joinedload(models.Ticket.time_entries)
            .joinedload(models.TicketTimeEntry.user)
        )\
        .filter(models.Account.id == account_id)\
        .first()
        
    if not account: raise HTTPException(status_code=404, detail="Account not found")

    # SOFT DELETE FILTERING (Python Side)
    # We filter the relationships before returning to Pydantic
    account.projects = [p for p in account.projects if not p.is_deleted]
    account.tickets = [t for t in account.tickets if not t.is_deleted]

    return account

@app.post("/accounts", response_model=schemas.AccountResponse)
def create_account(account: schemas.AccountCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    
    new_account = models.Account(**account.model_dump(), audit_data={})
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account

@app.put("/accounts/{account_id}", response_model=schemas.AccountResponse)
def update_account(account_id: str, account_update: schemas.AccountUpdate, db: Session = Depends(get_db)):
    db_account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not db_account: raise HTTPException(status_code=404, detail="Account not found")
    
    update_data = account_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_account, key, value)
    db.commit()
    db.refresh(db_account)
    return db_account

# --- CONTACT ENDPOINTS ---
@app.post("/contacts", response_model=schemas.ContactResponse)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    new_contact = models.Contact(**contact.model_dump(), is_primary_contact=False)
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact

@app.put("/contacts/{contact_id}", response_model=schemas.ContactResponse)
def update_contact(contact_id: str, contact_update: schemas.ContactUpdate, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact: raise HTTPException(status_code=404, detail="Contact not found")
    
    update_data = contact_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(contact, key, value)
    db.commit()
    db.refresh(contact)
    return contact

# --- DEAL ENDPOINTS (Restored) ---
# --- SECURE DEALS (Fixes "Seeing other clients' deals") ---
@app.get("/deals", response_model=List[schemas.DealResponse])
def get_deals(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Deal).join(models.Account)
    
    # SECURITY PATCH: Clients only see THEIR deals
    if current_user.role == 'client':
        query = query.filter(models.Account.id == current_user.account_id)
    
    elif current_user.access_scope == 'nt_only':
        query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only':
        query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
        
    deals = query.all()
    for d in deals: d.account_name = d.account.name
    return deals

@app.get("/deals/{deal_id}", response_model=schemas.DealResponse)
def get_deal_detail(deal_id: str, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal: raise HTTPException(status_code=404, detail="Deal not found")
    if current_user.access_scope == 'nt_only' and deal.account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Forbidden")
    deal.account_name = deal.account.name
    return deal

@app.post("/deals", response_model=schemas.DealResponse)
def create_deal(deal: schemas.DealCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    new_deal = models.Deal(**deal.model_dump())
    db.add(new_deal)
    db.commit()
    db.refresh(new_deal)
    new_deal.account_name = new_deal.account.name 
    return new_deal

@app.put("/deals/{deal_id}", response_model=schemas.DealResponse)
def update_deal(deal_id: str, deal_update: schemas.DealUpdate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal: raise HTTPException(status_code=404, detail="Deal not found")
    
    update_data = deal_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(deal, key, value)
    db.commit()
    db.refresh(deal)
    deal.account_name = deal.account.name
    return deal

# --- TICKET ENDPOINTS (PATCHED FOR MATERIALS) ---

# --- 3. SECURE TICKET LIST ---
@app.get("/tickets", response_model=List[schemas.TicketResponse])
def get_tickets(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Ticket)\
        .join(models.Account)\
        .options(
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.user),
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.product),
            joinedload(models.Ticket.materials).joinedload(models.TicketMaterial.product),
            joinedload(models.Ticket.milestone).joinedload(models.Milestone.project),
            joinedload(models.Ticket.contacts) # <--- PLURAL (M2M)
        )\
        .filter(models.Ticket.is_deleted == False)

    if current_user.access_scope == 'nt_only':
        query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only':
        query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
    
    if current_user.role == 'client':
        query = query.filter(models.Ticket.account_id == current_user.account_id)

    tickets = query.order_by(models.Ticket.id.desc()).all()
    
    results = []
    for t in tickets:
        t_dict = t.__dict__.copy() 
        t_dict['account_name'] = t.account.name
        
        # MAP LIST OF CONTACTS TO STRING
        names = [f"{c.first_name} {c.last_name}" for c in t.contacts]
        t_dict['contact_name'] = ", ".join(names) if names else None
        
        t_dict['contacts'] = t.contacts 
        t_dict['total_hours'] = t.total_hours
        t_dict['time_entries'] = t.time_entries 
        t_dict['materials'] = t.materials 

        # FINANCIAL GUARD: Find invoices linked to this ticket
        # We query invoice_items that reference this ticket_id
        linked_items = db.query(models.InvoiceItem).options(joinedload(models.InvoiceItem.invoice))\
            .filter(models.InvoiceItem.ticket_id == t.id).all()
        
        unique_invoices = {}
        for item in linked_items:
            if item.invoice:
                unique_invoices[item.invoice.id] = item.invoice
        
        t_dict['related_invoices'] = list(unique_invoices.values())
        
        if t.milestone:
            t_dict['milestone_name'] = t.milestone.name
            if t.milestone.project:
                t_dict['project_id'] = t.milestone.project.id
                t_dict['project_name'] = t.milestone.project.name
            
        results.append(t_dict)
    return results

@app.post("/tickets", response_model=schemas.TicketResponse)
def create_ticket(
    ticket: schemas.TicketCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # 1. SECURITY & CONTEXT OVERRIDE
    target_account_id = ticket.account_id
    
    if current_user.role == 'client':
        target_account_id = current_user.account_id
        ticket.assigned_tech_id = None
        ticket.milestone_id = None
        if not ticket.ticket_type: ticket.ticket_type = 'support'

        # Identity Unification (Link Portal User to Contact)
        linked_contact = db.query(models.Contact).filter(
            models.Contact.account_id == current_user.account_id,
            models.Contact.email == current_user.email
        ).first()

        if linked_contact:
            if linked_contact.id not in ticket.contact_ids:
                ticket.contact_ids.append(linked_contact.id)

    new_ticket = models.Ticket(
        account_id=target_account_id,
        subject=ticket.subject,
        description=ticket.description, # <--- THE MISSING LINK
        priority=ticket.priority,
        status='new',
        assigned_tech_id=ticket.assigned_tech_id,
        ticket_type=ticket.ticket_type,
        milestone_id=ticket.milestone_id
    )

    if ticket.contact_ids: 
        new_ticket.contacts = db.query(models.Contact).filter(models.Contact.id.in_(ticket.contact_ids)).all()
        
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    
    # Eager load for response/email
    new_ticket.account = db.query(models.Account).filter(models.Account.id == target_account_id).first()
    new_ticket.account_name = new_ticket.account.name 
    
    # 2. NOTIFICATIONS (Client Creation)
    if current_user.role == 'client':
        try:
            admin_html = f"""
            <p><strong>New Portal Request</strong></p>
            <p><strong>Client:</strong> {new_ticket.account_name}</p>
            <p><strong>User:</strong> {current_user.full_name} ({current_user.email})</p>
            <p><strong>Subject:</strong> {new_ticket.subject}</p>
            <p><strong>Description:</strong><br>{new_ticket.description}</p>
            <p><a href="https://core.digitalsanctum.com.au/tickets/{new_ticket.id}">View in Core</a></p>
            """
            email_service.send(email_service.admin_email, f"New Ticket: {new_ticket.subject}", admin_html)
            
            receipt_html = f"""
            <p>We received your request: <strong>{new_ticket.subject}</strong></p>
            <p>Ticket ID: #{new_ticket.id}</p>
            <p>Our team is reviewing it now.</p>
            """
            email_service.send(current_user.email, f"Ticket #{new_ticket.id} Received", receipt_html)
        except Exception as e:
            print(f"Email failed: {e}")
    
    return new_ticket

@app.put("/tickets/{ticket_id}", response_model=schemas.TicketResponse)
def update_ticket(
    ticket_id: int,
    ticket_update: schemas.TicketUpdate,
    db: Session = Depends(get_db)
):
    ticket = db.query(models.Ticket)\
        .options(
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.user),
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.product),
            joinedload(models.Ticket.materials).joinedload(models.TicketMaterial.product),
            joinedload(models.Ticket.contacts) # <--- PLURAL
        )\
        .filter(models.Ticket.id == ticket_id).first()
        
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")
        
    update_data = ticket_update.model_dump(exclude_unset=True)
    
    # HANDLE M2M CONTACTS
    if 'contact_ids' in update_data:
        ids = update_data.pop('contact_ids') 
        # Replace the entire list with the new selection
        ticket.contacts = db.query(models.Contact).filter(models.Contact.id.in_(ids)).all()

    if 'status' in update_data and update_data['status'] == 'resolved' and ticket.status != 'resolved':
        if 'closed_at' not in update_data:
            ticket.closed_at = func.now()

    for key, value in update_data.items():
        setattr(ticket, key, value)
        
    db.commit()
    db.refresh(ticket)
    
    # RESPONSE MAPPING
    ticket.account_name = ticket.account.name
    names = [f"{c.first_name} {c.last_name}" for c in ticket.contacts]
    ticket.contact_name = ", ".join(names) if names else None
    
    return ticket

# --- TIME ENTRY ENDPOINTS ---
@app.post("/tickets/{ticket_id}/time_entries", response_model=schemas.TimeEntryResponse)
def create_time_entry(
    ticket_id: int,
    entry: schemas.TimeEntryCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")

    new_entry = models.TicketTimeEntry(
        ticket_id=ticket_id,
        user_id=current_user.id,
        start_time=entry.start_time,
        end_time=entry.end_time,
        description=entry.description,
        product_id=entry.product_id # <--- THIS WAS MISSING
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    
    # Reload relationships for response
    new_entry.user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if entry.product_id:
        new_entry.product = db.query(models.Product).filter(models.Product.id == entry.product_id).first()
    
    return new_entry

@app.post("/tickets/time_entries/{entry_id}/duplicate", response_model=schemas.TimeEntryResponse)
def duplicate_time_entry(
    entry_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch Source
    original = db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.id == entry_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Entry not found")

    # 2. Create Clone
    # We copy exact timestamps. User can edit the date on the new row if needed.
    new_entry = models.TicketTimeEntry(
        ticket_id=original.ticket_id,
        user_id=current_user.id, # The person duplicating owns the new entry
        product_id=original.product_id,
        start_time=original.start_time,
        end_time=original.end_time,
        description=original.description
    )
    
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    
    # 3. Hydrate Relations for Response
    new_entry.user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if new_entry.product_id:
        new_entry.product = db.query(models.Product).filter(models.Product.id == new_entry.product_id).first()
        
    return new_entry

@app.delete("/tickets/{ticket_id}/time_entries/{entry_id}")
def delete_time_entry(ticket_id: int, entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.id == entry_id, models.TicketTimeEntry.ticket_id == ticket_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"status": "deleted"}

@app.put("/tickets/time_entries/{entry_id}", response_model=schemas.TimeEntryResponse)
def update_time_entry(
    entry_id: str,
    update: schemas.TimeEntryUpdate,
    db: Session = Depends(get_db)
):
    entry = db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.id == entry_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Entry not found")
    
    if update.start_time: entry.start_time = update.start_time
    if update.end_time: entry.end_time = update.end_time
    if update.description is not None: entry.description = update.description
    if update.product_id: 
        entry.product_id = update.product_id
        entry.product = db.query(models.Product).filter(models.Product.id == update.product_id).first() # Reload rel

    db.commit()
    db.refresh(entry)
    return entry

@app.put("/tickets/materials/{material_id}", response_model=schemas.TicketMaterialResponse)
def update_ticket_material(
    material_id: str,
    update: schemas.TicketMaterialUpdate,
    db: Session = Depends(get_db)
):
    mat = db.query(models.TicketMaterial).filter(models.TicketMaterial.id == material_id).first()
    if not mat: raise HTTPException(status_code=404, detail="Material not found")
    
    if update.quantity is not None: mat.quantity = update.quantity
    if update.product_id:
        mat.product_id = update.product_id
        mat.product = db.query(models.Product).filter(models.Product.id == update.product_id).first() # Reload rel

    db.commit()
    db.refresh(mat)
    return mat

# --- AUDIT ENDPOINTS (RESTORED) ---
# --- SECURE AUDITS (Fixes "Seeing unknown client audits") ---
@app.get("/audits", response_model=List[schemas.AuditResponse])
def get_audits(
    account_id: Optional[str] = None, 
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.AuditReport)
    
    # SECURITY PATCH: Clients only see THEIR audits
    if current_user.role == 'client':
        query = query.filter(models.AuditReport.account_id == current_user.account_id)
        
    elif current_user.access_scope == 'nt_only':
        query = query.join(models.Account).filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only':
        query = query.join(models.Account).filter(models.Account.brand_affinity.in_(['ds', 'both']))
        
    if account_id:
        query = query.filter(models.AuditReport.account_id == account_id)
        
    return query.all()

@app.get("/audits/{audit_id}", response_model=schemas.AuditResponse)
def get_audit_detail(audit_id: str, db: Session = Depends(get_db)):
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit: raise HTTPException(status_code=404, detail="Audit not found")
    return audit

@app.post("/audits", response_model=schemas.AuditResponse)
def create_audit_draft(audit: schemas.AuditCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    content_payload = {"items": [item.model_dump() for item in audit.items]}
    new_audit = models.AuditReport(
        account_id=audit.account_id, deal_id=audit.deal_id,
        content=content_payload, status="draft"
    )
    db.add(new_audit)
    db.commit()
    db.refresh(new_audit)
    return new_audit

@app.put("/audits/{audit_id}", response_model=schemas.AuditResponse)
def update_audit_content(audit_id: str, audit_update: schemas.AuditUpdate, db: Session = Depends(get_db)):
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit: raise HTTPException(status_code=404, detail="Audit not found")
    
    content_payload = {"items": [item.model_dump() for item in audit_update.items]}
    audit.content = content_payload
    
    total_score = 0
    items = audit_update.items
    if items:
        for item in items:
            s = item.status.lower()
            if s == 'green': total_score += 100
            elif s == 'amber': total_score += 50
        final_score = int(total_score / len(items))
    else: final_score = 0

    audit.security_score = final_score
    audit.infrastructure_score = final_score
    audit.updated_at = func.now()
    db.commit()
    db.refresh(audit)
    return audit

@app.post("/audits/{audit_id}/finalize", response_model=schemas.AuditResponse)
def finalize_audit(audit_id: str, db: Session = Depends(get_db)):
    audit_record = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit_record: raise HTTPException(status_code=404, detail="Audit not found")
    account = db.query(models.Account).filter(models.Account.id == audit_record.account_id).first()
    
    items = audit_record.content.get('items', [])
    if not items: raise HTTPException(status_code=400, detail="Cannot finalize empty audit")

    total_score = 0
    for item in items:
        s = item.get('status', 'green')
        if s == 'green': total_score += 100
        elif s == 'amber': total_score += 50
    final_score = int(total_score / len(items))
    
    pdf_data = {
        "client_name": account.name,
        "security_score": final_score,
        "infrastructure_score": final_score, 
        "content": audit_record.content
    }
    filename = f"audit_{audit_id}.pdf"
    output_path = os.path.join("app/static/reports", filename)
    pdf = pdf_engine.generate_audit_pdf(pdf_data)
    pdf.output(output_path)
    
    audit_record.security_score = final_score
    audit_record.infrastructure_score = final_score
    audit_record.status = "finalized"
    audit_record.report_pdf_path = f"/static/reports/{filename}"
    audit_record.finalized_at = func.now() 

    db.commit()
    db.refresh(audit_record)
    return audit_record

# --- PRODUCT ENDPOINTS ---
@app.get("/products", response_model=List[schemas.ProductResponse])
def get_products(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    # HIDE CATALOG FROM CLIENTS
    if current_user.role == 'client': return []
    
    return db.query(models.Product).filter(models.Product.is_active == True).all()

@app.post("/products", response_model=schemas.ProductResponse)
def create_product(product: schemas.ProductCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.access_scope != 'global': raise HTTPException(status_code=403, detail="Forbidden")
    new_product = models.Product(**product.model_dump())
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

@app.delete("/products/{product_id}")
def archive_product(product_id: str, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.access_scope != 'global': raise HTTPException(status_code=403, detail="Forbidden")
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product: raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()
    return {"status": "archived"}

# --- SYSTEM DIAGNOSTICS ---
@app.get("/system/health")
def run_system_diagnostics(db: Session = Depends(get_db)):
    report = {
        "timestamp": datetime.now(),
        "status": "nominal",
        "checks": []
    }
    
    def add_check(name, status, message=""):
        report["checks"].append({"name": name, "status": status, "message": message})
        if status == "error": report["status"] = "degraded"

    # 1. DATABASE CONNECTION
    try:
        db.execute(text("SELECT 1"))
        add_check("PostgreSQL Connection", "ok", "Connected")
    except Exception as e:
        add_check("PostgreSQL Connection", "error", str(e))
        return report # Critical fail

        # 2. SCHEMA INTEGRITY
    required_tables = [
        (models.User, "users"),
        (models.Account, "accounts"),
        (models.Contact, "contacts"),
        (models.Deal, "deals"),
        (models.Ticket, "tickets"),
        (models.TicketTimeEntry, "ticket_time_entries"),
        (models.TicketMaterial, "ticket_materials"),
        (models.Project, "projects"),       # <--- ADDED
        (models.Milestone, "milestones"),   # <--- ADDED
        (models.DealItem, "deal_items"),
        (models.Invoice, "invoices"),
        (models.InvoiceItem, "invoice_items"),
        (models.AuditReport, "audit_reports"),
        (models.Product, "products"),
        (models.Comment, "comments")
    ]


    for model, name in required_tables:
        try:
            count = db.query(model).count()
            add_check(f"Schema: {name}", "ok", f"{count} records")
        except Exception as e:
            add_check(f"Schema: {name}", "error", f"Table missing or corrupt: {str(e)}")

    # 3. FILESYSTEM PERMISSIONS (Report Generation)
    try:
        test_path = "app/static/reports/health_check.tmp"
        with open(test_path, "w") as f:
            f.write("test")
        os.remove(test_path)
        add_check("Storage: /static/reports", "ok", "Writable")
    except Exception as e:
        add_check("Storage: /static/reports", "error", f"Permission Denied: {str(e)}")

    return report

# --- COMMENT ENDPOINTS ---
@app.get("/comments", response_model=List[schemas.CommentResponse])
def get_comments(ticket_id: Optional[int] = None, deal_id: Optional[str] = None, audit_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Comment)
    if ticket_id: query = query.filter(models.Comment.ticket_id == ticket_id)
    if deal_id: query = query.filter(models.Comment.deal_id == deal_id)
    if audit_id: query = query.filter(models.Comment.audit_id == audit_id)
    comments = query.order_by(models.Comment.created_at.desc()).all()
    for c in comments: c.author_name = c.author.full_name
    return comments

@app.post("/comments", response_model=schemas.CommentResponse)
def create_comment(comment: schemas.CommentCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    new_comment = models.Comment(
        author_id=current_user.id, body=comment.body, visibility=comment.visibility,
        ticket_id=comment.ticket_id, deal_id=comment.deal_id, audit_id=comment.audit_id
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    new_comment.author_name = current_user.full_name or current_user.email
    return new_comment

# --- TICKET MATERIAL ENDPOINTS ---

@app.post("/tickets/{ticket_id}/materials", response_model=schemas.TicketMaterialResponse)
def add_ticket_material(
    ticket_id: int,
    material: schemas.TicketMaterialCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")

    new_mat = models.TicketMaterial(
        ticket_id=ticket_id,
        product_id=material.product_id,
        quantity=material.quantity
    )
    db.add(new_mat)
    db.commit()
    db.refresh(new_mat)
    # Eager load product for response
    new_mat.product = db.query(models.Product).filter(models.Product.id == material.product_id).first()
    return new_mat

@app.delete("/tickets/{ticket_id}/materials/{material_id}")
def delete_ticket_material(ticket_id: int, material_id: str, db: Session = Depends(get_db)):
    mat = db.query(models.TicketMaterial).filter(models.TicketMaterial.id == material_id).first()
    if not mat: raise HTTPException(status_code=404, detail="Material not found")
    db.delete(mat)
    db.commit()
    return {"status": "deleted"}

# --- THE INVOICE GENERATOR ---

@app.post("/tickets/{ticket_id}/invoice", response_model=schemas.InvoiceResponse)
def generate_invoice_from_ticket(
    ticket_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(models.Ticket)\
        .options(
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.product),
            joinedload(models.Ticket.materials).joinedload(models.TicketMaterial.product)
        )\
        .filter(models.Ticket.id == ticket_id).first()
        
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")

    invoice_items_buffer = []
    running_subtotal = 0.0

    # 1. Process Labor
    for entry in ticket.time_entries:
        hours = entry.duration_minutes / 60
        if hours <= 0: continue 

        if entry.product:
            rate = entry.product.unit_price
            desc = f"Labor: {entry.product.name} ({entry.user_name})"
        else:
            rate = 0.0 
            desc = f"Labor: General Service ({entry.user_name})"
        
        if entry.description: desc += f" - {entry.description}"
        # REQUEST 4: SHOW TICKET NUMBER
        desc += f" [Ticket #{ticket_id}]" # <--- ADDED
        line_total = hours * rate
        
        invoice_items_buffer.append({
            "description": desc,
            "quantity": round(hours, 2),
            "unit_price": rate,
            "total": round(line_total, 2),
            # TRACEABILITY
            "ticket_id": ticket.id,
            "source_type": "time",
            "source_id": entry.id
        })
        running_subtotal += line_total

    # 2. Process Hardware
    for mat in ticket.materials:
        if mat.product:
            price = mat.product.unit_price
            name = f"Hardware: {mat.product.name}"
        else:
            price = 0.0
            name = "Hardware: Unidentified Item"
            name += f" [Ticket #{ticket_id}]" 
        
        line_total = mat.quantity * price
        invoice_items_buffer.append({
            "description": name,
            "quantity": float(mat.quantity),
            "unit_price": price,
            "total": round(line_total, 2),
            # TRACEABILITY
            "ticket_id": ticket.id,
            "source_type": "material",
            "source_id": mat.id
        })
        running_subtotal += line_total

    if not invoice_items_buffer:
        raise HTTPException(status_code=400, detail="No billable items found.")

    # 3. Calculate GST
    subtotal = round(running_subtotal, 2)
    gst = round(subtotal * 0.10, 2)
    total = round(subtotal + gst, 2)

    # 4. Create Invoice
    new_invoice = models.Invoice(
        account_id=ticket.account_id,
        status="draft",
        subtotal_amount=subtotal,
        gst_amount=gst,
        total_amount=total,
        due_date=datetime.now() + timedelta(days=14), 
        generated_at=func.now()
    )
    db.add(new_invoice)
    db.flush()

    # 5. Save Items with Traceability
    for item in invoice_items_buffer:
        db_item = models.InvoiceItem(
            invoice_id=new_invoice.id,
            description=item['description'],
            quantity=item['quantity'],
            unit_price=item['unit_price'],
            total=item['total'],
            # NEW FIELDS
            ticket_id=item['ticket_id'],
            source_type=item['source_type'],
            source_id=item['source_id']
        )
        db.add(db_item)

    db.commit()
    db.refresh(new_invoice)
    return new_invoice

@app.get("/invoices/{invoice_id}", response_model=schemas.InvoiceResponse)
def get_invoice_detail(
    invoice_id: str,
    db: Session = Depends(get_db)
):
    inv = db.query(models.Invoice)\
        .options(
            joinedload(models.Invoice.items).joinedload(models.InvoiceItem.ticket).joinedload(models.Ticket.contacts),
            joinedload(models.Invoice.delivery_logs).joinedload(models.InvoiceDeliveryLog.sender)
        )\
        .filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")
    
    inv.account_name = inv.account.name
    
    # 1. Map Log Sender Names
    for log in inv.delivery_logs:
        if log.sender:
            log.sender_name = log.sender.full_name

    # 2. Smart Context (CC Suggestions)
    # Collect all emails from contacts linked to tickets linked to this invoice
    cc_set = set()
    for item in inv.items:
        if item.ticket:
            for contact in item.ticket.contacts:
                if contact.email: cc_set.add(contact.email)
    
    inv.suggested_cc = list(cc_set)

    return inv

@app.post("/invoices/{invoice_id}/send")
def send_invoice_email(
    invoice_id: str,
    request: schemas.InvoiceSendRequest,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch Invoice
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")

    # 2. AUTO-GENERATE PDF IF MISSING
    # This fixes the 400 Bad Request
    abs_path = ""
    
    if not inv.pdf_path or not os.path.exists(os.path.join(os.getcwd(), "app", inv.pdf_path.lstrip("/"))):
        print("DEBUG: PDF Missing. Regenerating...")
        
        # Prepare Data for Engine
        # LOGIC UPGRADE: Append [Ref: #ID] if it's missing from description
        items_data = []
        for item in inv.items:
            description = item.description
            # Dynamically append Ticket Ref if linked and not already present in text
            if item.ticket_id and f"#{item.ticket_id}" not in description:
                description += f" [Ref: Ticket #{item.ticket_id}]"
            
            items_data.append({
                "desc": description,
                "qty": item.quantity,
                "price": item.unit_price,
                "total": item.total
            })

        data = {
            "id": str(inv.id),
            "client_name": inv.account.name,
            "date": str(inv.generated_at.date()),
            "subtotal": inv.subtotal_amount,
            "gst": inv.gst_amount,
            "total": inv.total_amount,
            "payment_terms": inv.payment_terms,
            "items": items_data
        }
        
        # Generate
        pdf = pdf_engine.generate_invoice_pdf(data)
        
        # Save
        filename = f"invoice_{inv.id}.pdf"
        rel_path = f"/static/reports/{filename}"
        abs_path = os.path.join(os.getcwd(), "app/static/reports", filename)
        
        pdf.output(abs_path)
        
        # Update DB
        inv.pdf_path = rel_path
        db.commit()
    else:
        rel_path = inv.pdf_path.lstrip("/")
        abs_path = os.path.join(os.getcwd(), "app", rel_path)

    # 3. Construct Email
    subject = request.subject or f"Invoice #{inv.id} from Digital Sanctum"
    
    html_body = request.message or f"""
    <p>Dear Client,</p>
    <p>Please find attached invoice #{str(inv.id)[:8]} for <strong>${inv.total_amount:,.2f}</strong>.</p>
    <p>Due Date: {inv.due_date}</p>
    <p>You can also view this invoice in your <a href="https://core.digitalsanctum.com.au/portal">Client Portal</a>.</p>
    <p>Regards,<br>Digital Sanctum Accounts</p>
    """
    if "\n" in html_body and "<p>" not in html_body:
        html_body = html_body.replace("\n", "<br>")

    # 4. Send
    success = email_service.send(
        to_emails=[request.to_email],
        subject=subject,
        html_content=html_body,
        cc_emails=request.cc_emails,
        attachments=[abs_path] # Now guaranteed to exist
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Email service failed (Check API Key).")

    # 5. Log & Update Status
    log = models.InvoiceDeliveryLog(
        invoice_id=inv.id,
        sent_by_user_id=current_user.id,
        sent_to=request.to_email,
        sent_cc=", ".join(request.cc_emails) if request.cc_emails else None,
        status="sent"
    )
    db.add(log)
    inv.status = 'sent'
    db.commit()
    
    return {"status": "sent"}

@app.put("/invoices/{invoice_id}", response_model=schemas.InvoiceResponse)
def update_invoice_meta(
    invoice_id: str,
    update: schemas.InvoiceUpdate,
    db: Session = Depends(get_db)
):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")
    
    if update.status: inv.status = update.status
    if update.due_date: inv.due_date = update.due_date
    if update.payment_terms: inv.payment_terms = update.payment_terms
    if update.generated_at: inv.generated_at = update.generated_at # NEW
    
    # Trigger PDF regeneration needed? 
    # If we change terms, the PDF on disk is outdated.
    # Simple fix: invalidate the path.
    # Invalidate PDF if dates changed
    if update.due_date or update.generated_at or update.payment_terms:
        inv.pdf_path = None 

    db.commit()
    db.refresh(inv)
    inv.account_name = inv.account.name
    return inv

@app.delete("/invoices/{invoice_id}")
def delete_invoice(
    invoice_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Fetch invoice
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Optional: Prevent deleting if status is 'paid'
    # if invoice.status == 'paid':
    #     raise HTTPException(status_code=400, detail="Cannot delete a paid invoice.")

    db.delete(invoice)
    db.commit()
    return {"status": "deleted"}

@app.post("/invoices/{invoice_id}/items", response_model=schemas.InvoiceResponse)
def add_invoice_item(
    invoice_id: str,
    item: schemas.InvoiceItemCreate,
    db: Session = Depends(get_db)
):
    # 1. Create Item
    new_item = models.InvoiceItem(
        invoice_id=invoice_id,
        description=item.description,
        quantity=item.quantity,
        unit_price=item.unit_price,
        total=round(item.quantity * item.unit_price, 2)
    )
    db.add(new_item)
    db.commit()
    
    # 2. Recalculate Invoice Totals
    return recalculate_invoice(invoice_id, db)

@app.put("/invoices/items/{item_id}", response_model=schemas.InvoiceResponse)
def update_invoice_item(
    item_id: str,
    update: schemas.InvoiceItemUpdate,
    db: Session = Depends(get_db)
):
    item = db.query(models.InvoiceItem).filter(models.InvoiceItem.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    
    if update.description is not None: item.description = update.description
    if update.quantity is not None: item.quantity = update.quantity
    if update.unit_price is not None: item.unit_price = update.unit_price
    
    # Recalculate line total immediately
    item.total = round(item.quantity * item.unit_price, 2)
    
    db.commit()
    
    # Return the PARENT Invoice (refreshed)
    return recalculate_invoice(item.invoice_id, db)

@app.delete("/invoices/items/{item_id}", response_model=schemas.InvoiceResponse)
def delete_invoice_item(
    item_id: str,
    db: Session = Depends(get_db)
):
    item = db.query(models.InvoiceItem).filter(models.InvoiceItem.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    
    parent_id = item.invoice_id
    db.delete(item)
    db.commit()
    
    return recalculate_invoice(parent_id, db)

# --- 2. SECURE PROJECTS LIST ---
@app.get("/projects", response_model=List[schemas.ProjectResponse])
def get_projects(
    account_id: Optional[str] = None,
    current_user: models.User = Depends(auth.get_current_active_user), # ADDED USER CHECK
    db: Session = Depends(get_db)
):
    query = db.query(models.Project).join(models.Account).filter(models.Project.is_deleted == False)
    
    # SECURITY PATCH: Clients only see their own projects
    if current_user.role == 'client':
        query = query.filter(models.Project.account_id == current_user.account_id)

    if account_id:
        query = query.filter(models.Project.account_id == account_id)
        
    projects = query.all()
    for p in projects: p.account_name = p.account.name
    return projects

@app.get("/projects/{project_id}", response_model=schemas.ProjectResponse)
def get_project_detail(project_id: str, db: Session = Depends(get_db)):
    project = db.query(models.Project)\
        .options(joinedload(models.Project.milestones))\
        .options(joinedload(models.Project.account))\
        .filter(models.Project.id == project_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    
    project.account_name = project.account.name
    return project

@app.post("/projects", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    # BLOCK CLIENTS
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")

    new_project = models.Project(**project.model_dump())
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    new_project.account = db.query(models.Account).filter(models.Account.id == project.account_id).first()
    new_project.account_name = new_project.account.name
    return new_project

@app.put("/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(
    project_id: str,
    update: schemas.ProjectUpdate,
    db: Session = Depends(get_db)
):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj: raise HTTPException(status_code=404, detail="Project not found")
    
    if update.status: proj.status = update.status
    if update.name: proj.name = update.name
    if update.budget is not None: proj.budget = update.budget
    if update.due_date: proj.due_date = update.due_date
    
    db.commit()
    db.refresh(proj)
    proj.account_name = proj.account.name
    return proj

# --- MILESTONE ENDPOINTS ---

@app.post("/projects/{project_id}/milestones", response_model=schemas.MilestoneResponse)
def create_milestone(project_id: str, milestone: schemas.MilestoneCreate, db: Session = Depends(get_db)):
    new_milestone = models.Milestone(**milestone.model_dump(), project_id=project_id)
    db.add(new_milestone)
    db.commit()
    db.refresh(new_milestone)
    return new_milestone

@app.put("/milestones/{milestone_id}", response_model=schemas.MilestoneResponse)
def update_milestone(
    milestone_id: str,
    update: schemas.MilestoneUpdate,
    db: Session = Depends(get_db)
):
    ms = db.query(models.Milestone).filter(models.Milestone.id == milestone_id).first()
    if not ms: raise HTTPException(status_code=404, detail="Milestone not found")
    
    # Update all allowed fields
    if update.status: ms.status = update.status
    if update.name: ms.name = update.name
    if update.billable_amount is not None: ms.billable_amount = update.billable_amount
    if update.due_date: ms.due_date = update.due_date
    if update.sequence is not None: ms.sequence = update.sequence
    
    db.commit()
    db.refresh(ms)
    return ms

@app.post("/milestones/{milestone_id}/invoice", response_model=schemas.InvoiceResponse)
def generate_milestone_invoice(milestone_id: str, db: Session = Depends(get_db)):
    # 1. Fetch Milestone
    ms = db.query(models.Milestone).join(models.Project).filter(models.Milestone.id == milestone_id).first()
    if not ms: raise HTTPException(status_code=404, detail="Milestone not found")
    if ms.billable_amount <= 0: raise HTTPException(status_code=400, detail="Nothing to bill")
    if ms.invoice_id: raise HTTPException(status_code=400, detail="Already invoiced")

    # 2. Calculate GST
    subtotal = ms.billable_amount
    gst = round(subtotal * 0.10, 2)
    total = round(subtotal + gst, 2)

    # 3. Create Invoice
    new_invoice = models.Invoice(
        account_id=ms.project.account_id,
        status="draft",
        subtotal_amount=subtotal,
        gst_amount=gst,
        total_amount=total,
        due_date=datetime.now() + timedelta(days=14),
        generated_at=func.now()
    )
    db.add(new_invoice)
    db.flush()

    # 4. Create Line Item
    line_item = models.InvoiceItem(
        invoice_id=new_invoice.id,
        description=f"Project Milestone: {ms.project.name} - {ms.name}",
        quantity=1,
        unit_price=subtotal,
        total=subtotal
    )
    db.add(line_item)
    
    # 5. Link Milestone to Invoice
    ms.invoice_id = new_invoice.id
    ms.status = 'completed' # Auto-complete milestone on billing?

    db.commit()
    db.refresh(new_invoice)
    return new_invoice

@app.post("/projects/{project_id}/milestones/reorder")
def reorder_milestones(
    project_id: str,
    payload: schemas.MilestoneReorderRequest,
    db: Session = Depends(get_db)
):
    for item in payload.items:
        ms = db.query(models.Milestone).filter(models.Milestone.id == item.id, models.Milestone.project_id == project_id).first()
        if ms:
            ms.sequence = item.sequence
    db.commit()
    return {"status": "updated"}

@app.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj: raise HTTPException(status_code=404, detail="Project not found")
    
    proj.is_deleted = True # Soft Delete
    db.commit()
    return {"status": "archived"}

@app.delete("/tickets/{ticket_id}")
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    tick = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not tick: raise HTTPException(status_code=404, detail="Ticket not found")
    
    tick.is_deleted = True # Soft Delete
    db.commit()
    return {"status": "archived"}

# --- PORTAL ADMINISTRATION (For Staff) ---

@app.post("/accounts/{account_id}/users", response_model=schemas.UserResponse)
def create_client_user(
    account_id: str,
    user_data: schemas.ClientUserCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role == 'client':
        raise HTTPException(status_code=403, detail="Clients cannot create users.")

    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = auth.get_password_hash(user_data.password)
    new_user = models.User(
        email=user_data.email,
        password_hash=hashed_pw,
        full_name=user_data.full_name,
        role="client",
        access_scope="restricted",
        account_id=account_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # NOTIFICATION (NEW)
    # Note: In a real app, we'd send a reset link, but for now we send the raw password (MVP Only)
    # or just a "You have access" email.
    
    welcome_html = f"""
    <h1>Welcome to Sanctum Core</h1>
    <p>Hello {user_data.full_name},</p>
    <p>You have been granted access to the Client Portal.</p>
    <p><strong>Login:</strong> {user_data.email}</p>
    <p><strong>Password:</strong> {user_data.password}</p> 
    <p><a href="https://core.digitalsanctum.com.au/login">Login Here</a></p>
    """
    email_service.send(user_data.email, "Portal Access Granted", welcome_html)
    
    return new_user

@app.get("/accounts/{account_id}/users", response_model=List[schemas.UserResponse])
def get_client_users(
    account_id: str,
    db: Session = Depends(get_db)
):
    return db.query(models.User).filter(models.User.account_id == account_id).all()

@app.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    # Simple delete for now
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}

# --- THE MIRROR (Client Facing API) ---

@app.get("/portal/dashboard", response_model=schemas.PortalDashboard)
def get_portal_dashboard(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # 1. STRICT SECURITY GATE
    if current_user.role != 'client' or not current_user.account_id:
        raise HTTPException(status_code=403, detail="Portal access only.")

    aid = current_user.account_id

    # 2. Fetch Context
    account = db.query(models.Account).filter(models.Account.id == aid).first()
    
    # 3. Fetch Operations (Read Only views)
    tickets = db.query(models.Ticket)\
        .options(joinedload(models.Ticket.time_entries), joinedload(models.Ticket.materials))\
        .filter(models.Ticket.account_id == aid, models.Ticket.is_deleted == False)\
        .order_by(desc(models.Ticket.created_at)).all()

    invoices = db.query(models.Invoice)\
        .options(joinedload(models.Invoice.items))\
        .filter(models.Invoice.account_id == aid)\
        .order_by(desc(models.Invoice.generated_at)).all()
        
    projects = db.query(models.Project)\
        .options(joinedload(models.Project.milestones))\
        .filter(models.Project.account_id == aid, models.Project.is_deleted == False).all()

    # 4. Get Latest Audit Score
    last_audit = db.query(models.AuditReport)\
        .filter(models.AuditReport.account_id == aid, models.AuditReport.status == 'finalized')\
        .order_by(desc(models.AuditReport.finalized_at)).first()
    
    score = last_audit.security_score if last_audit else 0

    return {
        "account": account,
        "security_score": score,
        "open_tickets": tickets,
        "invoices": invoices,
        "projects": projects
    }

# --- PUBLIC LEAD INGESTION (RESTORED & UPGRADED) ---

@app.post("/public/lead")
def submit_public_lead(lead: schemas.LeadSchema, db: Session = Depends(get_db)):
    # 1. Create the Account (Company)
    new_account = models.Account(
        name=lead.company,
        type="business",
        status="lead",         
        brand_affinity="ds",   
        audit_data={           
            "size": lead.size,
            "challenge": lead.challenge,
            "initial_message": lead.message
        }
    )
    db.add(new_account)
    db.flush() 

    # 2. Create the Contact
    # Simple name split logic
    name_parts = lead.name.split(" ", 1)
    fname = name_parts[0]
    lname = name_parts[1] if len(name_parts) > 1 else ""

    new_contact = models.Contact(
        account_id=new_account.id,
        first_name=fname,
        last_name=lname,
        email=lead.email,
        is_primary_contact=True
    )
    db.add(new_contact)
    db.commit()

    # 3. PHASE 20: EMAIL NOTIFICATIONS
    
    # A. Internal Alert (To You)
    try:
        internal_html = f"""
        <h1>New Lead Detected</h1>
        <p><strong>Company:</strong> {lead.company}</p>
        <p><strong>Contact:</strong> {lead.name} ({lead.email})</p>
        <p><strong>Challenge:</strong> {lead.challenge}</p>
        <p><strong>Message:</strong><br>{lead.message}</p>
        <p><a href="https://core.digitalsanctum.com.au/clients/{new_account.id}">View in Core</a></p>
        """
        email_service.send(email_service.admin_email, f"New Lead: {lead.company}", internal_html)
    except Exception as e:
        print(f"Failed to send internal alert: {e}")

    # B. Auto-Responder (To Client)
    try:
        client_html = f"""
        <p>Hi {fname},</p>
        <p>Thank you for contacting Digital Sanctum regarding <strong>{lead.company}</strong>.</p>
        <p>We have received your application. A strategist will review your technical requirements and contact you within 24 hours to schedule a deep-dive.</p>
        <p>Regards,<br><strong>The Sanctum Team</strong></p>
        """
        email_service.send(lead.email, "Application Received - Digital Sanctum", client_html)
    except Exception as e:
        print(f"Failed to send auto-responder: {e}")

    return {"status": "received", "id": str(new_account.id)}

# --- CAMPAIGN ENDPOINTS ---

@app.get("/campaigns", response_model=List[schemas.CampaignResponse])
def get_campaigns(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Campaign)
    
    # Security Filter
    if current_user.access_scope == 'nt_only':
        query = query.filter(models.Campaign.brand_affinity == 'nt')
    elif current_user.access_scope == 'ds_only':
        query = query.filter(models.Campaign.brand_affinity == 'ds')
        
    return query.order_by(desc(models.Campaign.created_at)).all()

@app.post("/campaigns", response_model=schemas.CampaignResponse)
def create_campaign(
    campaign: schemas.CampaignCreate, 
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Security Check
    if current_user.access_scope == 'nt_only' and campaign.brand_affinity == 'ds':
         raise HTTPException(status_code=403, detail="Forbidden")

    new_campaign = models.Campaign(**campaign.model_dump())
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)
    return new_campaign

@app.get("/campaigns/{campaign_id}", response_model=schemas.CampaignResponse)
def get_campaign_detail(campaign_id: str, db: Session = Depends(get_db)):
    # Eager load targets to get counts? No, property handles it, but we need targets loaded
    # actually SQLAlchemy properties work best if relation is loaded or lazy.
    # Let's simple query.
    camp = db.query(models.Campaign).options(joinedload(models.Campaign.targets)).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    return camp

@app.put("/campaigns/{campaign_id}", response_model=schemas.CampaignResponse)
def update_campaign(campaign_id: str, update: schemas.CampaignUpdate, db: Session = Depends(get_db)):
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(camp, key, value)
        
    db.commit()
    db.refresh(camp)
    return camp

# --- THE LIST BUILDER ---
@app.post("/campaigns/{campaign_id}/targets/bulk", response_model=schemas.CampaignTargetAddResult)
def add_campaign_targets(
    campaign_id: str,
    filters: schemas.CampaignTargetFilter,
    db: Session = Depends(get_db)
):
    # 1. Find Campaign
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")

    # 2. Query Contacts based on Account properties
    # We join Contact -> Account
    query = db.query(models.Contact).join(models.Account)
    
    if filters.account_status:
        query = query.filter(models.Account.status == filters.account_status)
    
    if filters.brand_affinity:
        query = query.filter(models.Account.brand_affinity.in_([filters.brand_affinity, 'both']))
        
    # Exclude those already in the campaign?
    # Easier to just try/except integrity error or check existence
    potential_contacts = query.all()
    
    count = 0
    for contact in potential_contacts:
        if not contact.email: continue # Skip no email
        
        # Check existence
        exists = db.query(models.CampaignTarget).filter(
            models.CampaignTarget.campaign_id == campaign_id,
            models.CampaignTarget.contact_id == contact.id
        ).first()
        
        if not exists:
            new_target = models.CampaignTarget(
                campaign_id=campaign_id,
                contact_id=contact.id,
                status='targeted'
            )
            db.add(new_target)
            count += 1
            
    db.commit()
    return {"added_count": count, "message": f"Successfully added {count} targets."}

@app.get("/campaigns/{campaign_id}/targets", response_model=List[schemas.CampaignTargetResponse])
def get_campaign_targets(campaign_id: str, db: Session = Depends(get_db)):
    # Join to get contact details
    targets = db.query(models.CampaignTarget)\
        .options(joinedload(models.CampaignTarget.contact))\
        .filter(models.CampaignTarget.campaign_id == campaign_id).all()
    
    # Hydrate flat schema
    results = []
    for t in targets:
        t_dict = t.__dict__.copy()
        if t.contact:
            t_dict['contact_name'] = f"{t.contact.first_name} {t.contact.last_name}"
            t_dict['contact_email'] = t.contact.email
        else:
            t_dict['contact_name'] = "Unknown"
        results.append(t_dict)
        
    return results

# --- CAMPAIGN EXECUTION ENGINE ---

def execute_campaign_background(campaign_id: str, db: Session):
    """
    Background Task to process the queue.
    """
    # Re-fetch fresh session/objects since this runs in background
    # Actually, BackgroundTasks in FastAPI run *after* response but in same context if we aren't careful.
    # Ideally we pass IDs and get new DB session, but for this scale (MVP), passing the db session 
    # *might* work if not closed, but safer to use the existing one before it closes? 
    # No, FastAPI closes session after request.
    # FOR PHASE 27 MVP: We will run synchronously if list < 50, otherwise we need a worker.
    # Let's stick to synchronous with a high timeout limit for the "Jan 15" launch (Lists < 500).
    # Real background workers (Celery) are Phase 28.
    pass 

@app.post("/campaigns/{campaign_id}/test")
def send_campaign_test(
    campaign_id: str,
    target_email: str,
    db: Session = Depends(get_db)
):
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Mock Data
    subject = camp.subject_template.replace("{{first_name}}", "TestUser").replace("{{company}}", "TestCorp")
    body = camp.body_template.replace("{{first_name}}", "TestUser").replace("{{company}}", "TestCorp")
    
    # Convert newlines to BR if raw text
    if "\n" in body and "<p>" not in body:
        body = body.replace("\n", "<br>")
        
    email_service.send(target_email, f"[TEST] {subject}", body)
    return {"status": "sent"}

@app.post("/campaigns/{campaign_id}/launch")
async def launch_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    
    if camp.status == 'completed':
        raise HTTPException(status_code=400, detail="Campaign already completed")

    # VALIDATION GUARD: Check for Content
    if not camp.subject_template or not camp.body_template:
        raise HTTPException(status_code=400, detail="Campaign content is missing. Please save a Subject and Body in the Composer tab.")

    # Get Pending Targets
    targets = db.query(models.CampaignTarget)\
        .options(joinedload(models.CampaignTarget.contact).joinedload(models.Contact.account))\
        .filter(models.CampaignTarget.campaign_id == campaign_id, models.CampaignTarget.status == 'targeted')\
        .all()
        
    if not targets:
        raise HTTPException(status_code=400, detail="No pending targets found. Build your list first.")

    # EXECUTE LOOP
    sent_count = 0
    
    for t in targets:
        contact = t.contact
        if not contact or not contact.email:
            t.status = 'failed'
            continue
            
        # Variables
        fname = contact.first_name or "Partner"
        cname = contact.account.name if contact.account else "Your Company"
        
        # Hydrate (Safe now due to validation above)
        subject = camp.subject_template.replace("{{first_name}}", fname).replace("{{company}}", cname)
        body = camp.body_template.replace("{{first_name}}", fname).replace("{{company}}", cname)
        
        if "\n" in body and "<p>" not in body: body = body.replace("\n", "<br>")
        
        # Send
        success = email_service.send(contact.email, subject, body)
        
        if success:
            t.status = 'sent'
            t.sent_at = func.now() # Use DB timestamp function for safety
            sent_count += 1
        else:
            t.status = 'failed'
            
    camp.status = 'active'
    db.commit()
    
    return {"status": "launched", "sent_count": sent_count}
