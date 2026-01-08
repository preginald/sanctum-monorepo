from fastapi import FastAPI, Depends, HTTPException, status
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
    access_token = auth.create_access_token(data={"sub": user.email, "scope": user.access_scope})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    revenue_realized = 0.0
    pipeline_value = 0.0
    active_audits = 0
    open_tickets = 0
    critical_tickets = 0

    if current_user.access_scope in ['global', 'ds_only']:
        rev_q = db.query(func.sum(models.Deal.amount)).filter(models.Deal.stage == 'Accession').scalar()
        revenue_realized = rev_q if rev_q else 0.0
        pipe_q = db.query(func.sum(models.Deal.amount)).filter(models.Deal.stage != 'Accession').filter(models.Deal.stage != 'Lost').scalar()
        pipeline_value = pipe_q if pipe_q else 0.0
        active_audits = db.query(models.AuditReport).filter(models.AuditReport.status == 'draft').count()

    if current_user.access_scope in ['global', 'nt_only']:
        open_tickets = db.query(models.Ticket).filter(models.Ticket.status != 'resolved').count()
        critical_tickets = db.query(models.Ticket).filter(models.Ticket.status != 'resolved').filter(models.Ticket.priority == 'high').count()

    return {
        "revenue_realized": revenue_realized,
        "pipeline_value": pipeline_value,
        "active_audits": active_audits,
        "open_tickets": open_tickets,
        "critical_tickets": critical_tickets
    }

@app.post("/refresh", response_model=schemas.Token)
def refresh_session(
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Issues a new token for the currently logged in user."""
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": current_user.email, "scope": current_user.access_scope},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- ACCOUNT ENDPOINTS ---
@app.get("/accounts", response_model=List[schemas.AccountResponse])
def get_accounts(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    return db.query(models.Account).all()

@app.get("/accounts/{account_id}", response_model=schemas.AccountDetail)
def get_account_detail(account_id: str, db: Session = Depends(get_db)):
    account = db.query(models.Account)\
        .options(joinedload(models.Account.contacts))\
        .options(joinedload(models.Account.deals))\
        .options(joinedload(models.Account.invoices))\
        .options(
            joinedload(models.Account.tickets)
            .joinedload(models.Ticket.time_entries)
            .joinedload(models.TicketTimeEntry.user)
        )\
        .filter(models.Account.id == account_id)\
        .first()
    if not account: raise HTTPException(status_code=404, detail="Account not found")
    return account

@app.post("/accounts", response_model=schemas.AccountResponse)
def create_account(account: schemas.AccountCreate, db: Session = Depends(get_db)):
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
@app.get("/deals", response_model=List[schemas.DealResponse])
def get_deals(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Deal).join(models.Account)
    if current_user.access_scope == 'nt_only':
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

@app.get("/tickets", response_model=List[schemas.TicketResponse])
def get_tickets(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # EAGER LOAD: Time Entries (+User) AND Materials (+Product)
    query = db.query(models.Ticket)\
        .join(models.Account)\
        .options(
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.user),
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.product),
            joinedload(models.Ticket.materials).joinedload(models.TicketMaterial.product)
        )
    
    # Bifurcation (Optional - keep if you had it, otherwise standard query)
    if current_user.access_scope == 'nt_only':
        query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only':
        query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))

    tickets = query.order_by(models.Ticket.id.desc()).all()
    
    results = []
    for t in tickets:
        t_dict = t.__dict__.copy() 
        t_dict['account_name'] = t.account.name
        
        names = [f"{c.first_name} {c.last_name}" for c in t.contacts]
        t_dict['contact_name'] = ", ".join(names) if names else None
        t_dict['contacts'] = t.contacts 
        
        # Manually trigger properties for the Dictionary response
        t_dict['total_hours'] = t.total_hours
        t_dict['time_entries'] = t.time_entries 
        
        # NEW: Ensure materials are passed
        t_dict['materials'] = t.materials 
        
        results.append(t_dict)
    return results

@app.post("/tickets", response_model=schemas.TicketResponse)
def create_ticket(
    ticket: schemas.TicketCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    new_ticket = models.Ticket(
        account_id=ticket.account_id,
        subject=ticket.subject,
        priority=ticket.priority,
        status='new',
        assigned_tech_id=ticket.assigned_tech_id
    )
    if ticket.contact_ids: 
        new_ticket.contacts = db.query(models.Contact).filter(models.Contact.id.in_(ticket.contact_ids)).all()
        
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    new_ticket.account_name = new_ticket.account.name 
    return new_ticket

@app.put("/tickets/{ticket_id}", response_model=schemas.TicketResponse)
def update_ticket(
    ticket_id: int,
    ticket_update: schemas.TicketUpdate,
    db: Session = Depends(get_db)
):
    # Eager load EVERYTHING needed for the response
    ticket = db.query(models.Ticket)\
        .options(
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.user),
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.product),
            joinedload(models.Ticket.materials).joinedload(models.TicketMaterial.product)
        )\
        .filter(models.Ticket.id == ticket_id).first()
        
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")
        
    update_data = ticket_update.model_dump(exclude_unset=True)
    
    if 'contact_ids' in update_data:
        ids = update_data.pop('contact_ids') 
        ticket.contacts = db.query(models.Contact).filter(models.Contact.id.in_(ids)).all()

    if 'status' in update_data and update_data['status'] == 'resolved' and ticket.status != 'resolved':
        if 'closed_at' not in update_data:
            ticket.closed_at = func.now()

    for key, value in update_data.items():
        setattr(ticket, key, value)
        
    db.commit()
    db.refresh(ticket)
    
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
@app.get("/audits", response_model=List[schemas.AuditResponse])
def get_audits(
    account_id: Optional[str] = None, 
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.AuditReport)
    if account_id:
        query = query.filter(models.AuditReport.account_id == account_id)
        
    if current_user.access_scope == 'nt_only':
        query = query.join(models.Account).filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only':
        query = query.join(models.Account).filter(models.Account.brand_affinity.in_(['ds', 'both']))
        
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
def get_products(db: Session = Depends(get_db)):
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
        (models.TicketMaterial, "ticket_materials"), # NEW
        (models.DealItem, "deal_items"),             # NEW
        (models.Invoice, "invoices"),                # NEW
        (models.InvoiceItem, "invoice_items"),       # NEW
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
        .options(joinedload(models.Invoice.items))\
        .filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Hydrate Account Name
    inv.account_name = inv.account.name
    return inv

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
