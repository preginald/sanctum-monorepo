from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, func, desc
from datetime import timedelta, datetime
from pydantic import BaseModel

import time

import psutil

# UPDATED: Import SessionLocal for background tasks
from .database import get_db, SessionLocal
from . import models, schemas, auth
from .services.email_service import email_service
from .services.pdf_engine import pdf_engine

import os
from typing import List, Optional

app = FastAPI(title="Sanctum Core", version="1.7.0")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://core.digitalsanctum.com.au",
    "https://digitalsanctum.com.au"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- SYSTEM DIAGNOSTICS ---
@app.get("/system/health")
def run_system_diagnostics(db: Session = Depends(get_db)):
    start_time = time.time()
    
    # 1. GIT VERSION (Robust)
    try:
        # Resolve the directory of main.py, go up one level to sanctum-core
        cwd = os.path.dirname(os.path.abspath(__file__))
        parent = os.path.dirname(cwd) # /Dev/DigitalSanctum usually
        
        commit = subprocess.check_output(
            ['git', 'rev-parse', '--short', 'HEAD'], 
            cwd=parent, 
            stderr=subprocess.DEVNULL
        ).strip().decode('utf-8')
    except Exception as e:
        commit = "UNKNOWN"

    report = {
        "timestamp": datetime.now(),
        "version": commit,
        "status": "nominal",
        "system": {},
        "database": {"latency_ms": 0}, # Default Init
        "checks": []
    }
    
    def add_check(name, status, message="", latency_ms=0):
        report["checks"].append({
            "name": name, 
            "status": status, 
            "message": message,
            "latency": f"{latency_ms:.2f}ms" if latency_ms > 0 else None
        })
        if status == "error": report["status"] = "critical"
        elif status == "warning" and report["status"] != "critical": report["status"] = "degraded"

    # 2. SYSTEM VITALS
    try:
        du = psutil.disk_usage('/')
        mem = psutil.virtual_memory()
        report["system"] = {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": mem.percent,
            "disk_percent": du.percent,
            "disk_free_gb": round(du.free / (1024**3), 2)
        }
        if du.percent > 90: add_check("Storage", "warning", "Disk Space Low")
        else: add_check("Storage", "ok", f"{report['system']['disk_free_gb']}GB Free")
    except Exception as e:
        report["system"] = {"cpu_percent": 0, "memory_percent": 0, "disk_percent": 0, "disk_free_gb": 0}
        add_check("System Metrics", "error", str(e))

    # 3. DATABASE LATENCY
    try:
        t0 = time.time()
        # Simple scalar query is faster/safer
        db.execute(text("SELECT 1")) 
        t1 = time.time()
        latency = (t1 - t0) * 1000
        report["database"]["latency_ms"] = round(latency, 2)
        
        status = "ok"
        if latency > 100: status = "warning"
        if latency > 500: status = "error"
        
        add_check("Database Ping", status, "Connected", latency)
    except Exception as e:
        report["database"]["latency_ms"] = -1
        add_check("Database Ping", "error", str(e))
        # Do not return early, allow other checks to render

    # 4. SCHEMA INTEGRITY
    required_tables = [
        (models.User, "Users"),
        (models.Ticket, "Tickets"),
        (models.Invoice, "Invoices"),
        (models.Article, "Wiki")
    ]

    for model, name in required_tables:
        try:
            count = db.query(model).count()
            add_check(f"Table: {name}", "ok", f"{count} records")
        except Exception as e:
            add_check(f"Table: {name}", "error", "Missing/Corrupt")

    report["execution_time_ms"] = round((time.time() - start_time) * 1000, 2)
    return report

# --- AUTHENTICATION ---

@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    token_payload = {
        "sub": user.email, 
        "scope": user.access_scope,
        "role": user.role,
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
    token_payload = {
        "sub": current_user.email, 
        "scope": current_user.access_scope,
        "role": current_user.role,
        "id": str(current_user.id),
        "account_id": str(current_user.account_id) if current_user.account_id else None
    }
    access_token = auth.create_access_token(
        data=token_payload,
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- DASHBOARD ANALYTICS ---

@app.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    revenue_realized = 0.0
    pipeline_value = 0.0
    active_audits = 0
    open_tickets = 0
    critical_tickets = 0

    try:
        if current_user.access_scope in ['global', 'ds_only']:
            rev_q = db.query(func.sum(models.Deal.amount)).filter(models.Deal.stage == 'Accession').scalar()
            revenue_realized = float(rev_q) if rev_q else 0.0
            pipe_q = db.query(func.sum(models.Deal.amount)).filter(models.Deal.stage != 'Accession').filter(models.Deal.stage != 'Lost').scalar()
            pipeline_value = float(pipe_q) if pipe_q else 0.0
            active_audits = db.query(models.AuditReport).filter(models.AuditReport.status == 'draft').count()

        if current_user.access_scope in ['global', 'nt_only']:
            open_tickets = db.query(models.Ticket).filter(models.Ticket.status != 'resolved').count()
            critical_tickets = db.query(models.Ticket).filter(models.Ticket.status != 'resolved').filter(models.Ticket.priority == 'critical').count()

    except Exception as e:
        print(f"DASHBOARD ERROR: {str(e)}")
        return {
            "revenue_realized": 0.0, "pipeline_value": 0.0, "active_audits": 0, "open_tickets": 0, "critical_tickets": 0
        }

    return {
        "revenue_realized": revenue_realized,
        "pipeline_value": pipeline_value,
        "active_audits": active_audits,
        "open_tickets": open_tickets,
        "critical_tickets": critical_tickets
    }

# --- ACCOUNT ENDPOINTS ---

@app.get("/accounts", response_model=List[schemas.AccountResponse])
def get_accounts(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Account)
    if current_user.role == 'client':
        query = query.filter(models.Account.id == current_user.account_id)
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
    
    # Soft Delete Filtering
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

# --- USER MANAGEMENT ---

@app.post("/accounts/{account_id}/users", response_model=schemas.UserResponse)
def create_client_user(
    account_id: str,
    user_data: schemas.ClientUserCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = auth.get_password_hash(user_data.password)
    new_user = models.User(
        email=user_data.email, password_hash=hashed_pw, full_name=user_data.full_name,
        role="client", access_scope="restricted", account_id=account_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Notify
    try:
        welcome_html = f"""
        <h1>Welcome to Sanctum Core</h1>
        <p>Hello {user_data.full_name},</p>
        <p>You have been granted access to the Client Portal.</p>
        <p><strong>Login:</strong> {user_data.email}</p>
        <p><strong>Password:</strong> {user_data.password}</p> 
        <p><a href="https://core.digitalsanctum.com.au/login">Login Here</a></p>
        """
        email_service.send(user_data.email, "Portal Access Granted", welcome_html)
    except: pass
    
    return new_user

@app.get("/accounts/{account_id}/users", response_model=List[schemas.UserResponse])
def get_client_users(account_id: str, db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.account_id == account_id).all()

@app.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}

# --- TICKET ENDPOINTS ---

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
            joinedload(models.Ticket.contacts),
            joinedload(models.Ticket.articles)
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
        
        # Contacts string
        names = [f"{c.first_name} {c.last_name}" for c in t.contacts]
        t_dict['contact_name'] = ", ".join(names) if names else None
        
        t_dict['contacts'] = t.contacts 
        t_dict['total_hours'] = t.total_hours
        t_dict['time_entries'] = t.time_entries 
        t_dict['materials'] = t.materials 
        
        if t.milestone:
            t_dict['milestone_name'] = t.milestone.name
            if t.milestone.project:
                t_dict['project_id'] = t.milestone.project.id
                t_dict['project_name'] = t.milestone.project.name
        
        # Financial Guard Link
        linked_items = db.query(models.InvoiceItem).options(joinedload(models.InvoiceItem.invoice))\
            .filter(models.InvoiceItem.ticket_id == t.id).all()
        unique_invoices = {}
        for item in linked_items:
            if item.invoice: unique_invoices[item.invoice.id] = item.invoice
        t_dict['related_invoices'] = list(unique_invoices.values())
            
        results.append(t_dict)
    return results

@app.post("/tickets", response_model=schemas.TicketResponse)
def create_ticket(
    ticket: schemas.TicketCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    target_account_id = ticket.account_id
    if current_user.role == 'client':
        target_account_id = current_user.account_id
        ticket.assigned_tech_id = None
        ticket.milestone_id = None
        if not ticket.ticket_type: ticket.ticket_type = 'support'
        
        # Identity Link
        linked_contact = db.query(models.Contact).filter(
            models.Contact.account_id == current_user.account_id,
            models.Contact.email == current_user.email
        ).first()
        if linked_contact and linked_contact.id not in ticket.contact_ids:
            ticket.contact_ids.append(linked_contact.id)

    new_ticket = models.Ticket(
        account_id=target_account_id,
        subject=ticket.subject,
        description=ticket.description,
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
    new_ticket.account = db.query(models.Account).filter(models.Account.id == target_account_id).first()
    new_ticket.account_name = new_ticket.account.name 
    
    # Notify
    if current_user.role == 'client':
        try:
            email_service.send(email_service.admin_email, f"New Ticket: {new_ticket.subject}", "New Client Request")
        except: pass
    
    return new_ticket

@app.put("/tickets/{ticket_id}", response_model=schemas.TicketResponse)
def update_ticket(ticket_id: int, ticket_update: schemas.TicketUpdate, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).options(joinedload(models.Ticket.contacts)).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")
        
    update_data = ticket_update.model_dump(exclude_unset=True)
    
    if 'contact_ids' in update_data:
        ids = update_data.pop('contact_ids') 
        ticket.contacts = db.query(models.Contact).filter(models.Contact.id.in_(ids)).all()

    if 'status' in update_data and update_data['status'] == 'resolved' and ticket.status != 'resolved':
        if 'closed_at' not in update_data: ticket.closed_at = func.now()

    for key, value in update_data.items(): setattr(ticket, key, value)
    db.commit()
    db.refresh(ticket)
    
    ticket.account_name = ticket.account.name
    names = [f"{c.first_name} {c.last_name}" for c in ticket.contacts]
    ticket.contact_name = ", ".join(names) if names else None
    return ticket

@app.delete("/tickets/{ticket_id}")
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    tick = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not tick: raise HTTPException(status_code=404, detail="Ticket not found")
    tick.is_deleted = True
    db.commit()
    return {"status": "archived"}

# --- TICKET SUB-ITEMS ---
@app.post("/tickets/{ticket_id}/time_entries", response_model=schemas.TimeEntryResponse)
def create_time_entry(ticket_id: int, entry: schemas.TimeEntryCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")
    new_entry = models.TicketTimeEntry(
        ticket_id=ticket_id, user_id=current_user.id,
        start_time=entry.start_time, end_time=entry.end_time, description=entry.description,
        product_id=entry.product_id
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    new_entry.user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if entry.product_id: new_entry.product = db.query(models.Product).filter(models.Product.id == entry.product_id).first()
    return new_entry

@app.put("/tickets/time_entries/{entry_id}", response_model=schemas.TimeEntryResponse)
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

@app.delete("/tickets/{ticket_id}/time_entries/{entry_id}")
def delete_time_entry(ticket_id: int, entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(models.TicketTimeEntry).filter(models.TicketTimeEntry.id == entry_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"status": "deleted"}

@app.post("/tickets/time_entries/{entry_id}/duplicate", response_model=schemas.TimeEntryResponse)
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

@app.post("/tickets/{ticket_id}/materials", response_model=schemas.TicketMaterialResponse)
def add_ticket_material(ticket_id: int, material: schemas.TicketMaterialCreate, db: Session = Depends(get_db)):
    new_mat = models.TicketMaterial(ticket_id=ticket_id, product_id=material.product_id, quantity=material.quantity)
    db.add(new_mat)
    db.commit()
    db.refresh(new_mat)
    new_mat.product = db.query(models.Product).filter(models.Product.id == material.product_id).first()
    return new_mat

@app.put("/tickets/materials/{material_id}", response_model=schemas.TicketMaterialResponse)
def update_ticket_material(material_id: str, update: schemas.TicketMaterialUpdate, db: Session = Depends(get_db)):
    mat = db.query(models.TicketMaterial).filter(models.TicketMaterial.id == material_id).first()
    if not mat: raise HTTPException(status_code=404, detail="Material not found")
    if update.quantity is not None: mat.quantity = update.quantity
    if update.product_id: mat.product_id = update.product_id
    db.commit()
    db.refresh(mat)
    return mat

@app.delete("/tickets/{ticket_id}/materials/{material_id}")
def delete_ticket_material(ticket_id: int, material_id: str, db: Session = Depends(get_db)):
    mat = db.query(models.TicketMaterial).filter(models.TicketMaterial.id == material_id).first()
    if not mat: raise HTTPException(status_code=404, detail="Material not found")
    db.delete(mat)
    db.commit()
    return {"status": "deleted"}

# --- INVOICE ENGINE ---

def recalculate_invoice(invoice_id: str, db: Session):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice: return
    subtotal = 0.0
    for item in invoice.items:
        item.total = round(item.quantity * item.unit_price, 2)
        subtotal += item.total
    gst = round(subtotal * 0.10, 2)
    invoice.subtotal_amount = subtotal
    invoice.gst_amount = gst
    invoice.total_amount = round(subtotal + gst, 2)
    invoice.generated_at = func.now()
    db.commit()
    db.refresh(invoice)
    return invoice

@app.post("/tickets/{ticket_id}/invoice", response_model=schemas.InvoiceResponse)
def generate_invoice_from_ticket(ticket_id: int, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).options(
            joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.product),
            joinedload(models.Ticket.materials).joinedload(models.TicketMaterial.product)
        ).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")

    items_buffer = []
    running_subtotal = 0.0

    for entry in ticket.time_entries:
        hours = entry.duration_minutes / 60
        if hours <= 0: continue
        rate = entry.product.unit_price if entry.product else 0.0
        desc = f"Labor: {entry.product.name} ({entry.user_name})" if entry.product else f"Labor: General ({entry.user_name})"
        if entry.description: desc += f" - {entry.description}"
        desc += f" [Ref: Ticket #{ticket.id}]"
        
        line_total = hours * rate
        items_buffer.append({"description": desc, "quantity": round(hours, 2), "unit_price": rate, "total": round(line_total, 2), "ticket_id": ticket.id, "source_type": "time", "source_id": entry.id})
        running_subtotal += line_total

    for mat in ticket.materials:
        price = mat.product.unit_price if mat.product else 0.0
        name = f"Hardware: {mat.product.name}" if mat.product else "Hardware: Unidentified"
        name += f" [Ref: Ticket #{ticket.id}]"
        line_total = mat.quantity * price
        items_buffer.append({"description": name, "quantity": float(mat.quantity), "unit_price": price, "total": round(line_total, 2), "ticket_id": ticket.id, "source_type": "material", "source_id": mat.id})
        running_subtotal += line_total

    if not items_buffer: raise HTTPException(status_code=400, detail="No billable items.")

    subtotal = round(running_subtotal, 2)
    gst = round(subtotal * 0.10, 2)
    total = round(subtotal + gst, 2)

    new_invoice = models.Invoice(
        account_id=ticket.account_id, status="draft", subtotal_amount=subtotal, gst_amount=gst, total_amount=total,
        due_date=datetime.now() + timedelta(days=14), generated_at=func.now()
    )
    db.add(new_invoice)
    db.flush()

    for item in items_buffer:
        db.add(models.InvoiceItem(invoice_id=new_invoice.id, **item))

    db.commit()
    db.refresh(new_invoice)
    return new_invoice

@app.get("/invoices/{invoice_id}", response_model=schemas.InvoiceResponse)
def get_invoice_detail(invoice_id: str, db: Session = Depends(get_db)):
    inv = db.query(models.Invoice).options(
            joinedload(models.Invoice.items).joinedload(models.InvoiceItem.ticket).joinedload(models.Ticket.contacts),
            joinedload(models.Invoice.delivery_logs).joinedload(models.InvoiceDeliveryLog.sender)
        ).filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")
    inv.account_name = inv.account.name
    for log in inv.delivery_logs:
        if log.sender: log.sender_name = log.sender.full_name
    
    cc_set = set()
    for item in inv.items:
        if item.ticket:
            for c in item.ticket.contacts:
                if c.email: cc_set.add(c.email)
    inv.suggested_cc = list(cc_set)
    return inv

@app.put("/invoices/{invoice_id}", response_model=schemas.InvoiceResponse)
def update_invoice_meta(invoice_id: str, update: schemas.InvoiceUpdate, db: Session = Depends(get_db)):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")
    if update.status: inv.status = update.status
    if update.due_date: inv.due_date = update.due_date
    if update.payment_terms: inv.payment_terms = update.payment_terms
    if update.generated_at: inv.generated_at = update.generated_at
    if update.due_date or update.generated_at or update.payment_terms: inv.pdf_path = None
    db.commit()
    db.refresh(inv)
    inv.account_name = inv.account.name
    return inv

@app.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: str, db: Session = Depends(get_db)):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(inv)
    db.commit()
    return {"status": "deleted"}

@app.post("/invoices/{invoice_id}/items", response_model=schemas.InvoiceResponse)
def add_invoice_item(invoice_id: str, item: schemas.InvoiceItemCreate, db: Session = Depends(get_db)):
    new_item = models.InvoiceItem(
        invoice_id=invoice_id, description=item.description, quantity=item.quantity, unit_price=item.unit_price,
        total=round(item.quantity * item.unit_price, 2)
    )
    db.add(new_item)
    db.commit()
    return recalculate_invoice(invoice_id, db)

@app.put("/invoices/items/{item_id}", response_model=schemas.InvoiceResponse)
def update_invoice_item(item_id: str, update: schemas.InvoiceItemUpdate, db: Session = Depends(get_db)):
    item = db.query(models.InvoiceItem).filter(models.InvoiceItem.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    if update.description is not None: item.description = update.description
    if update.quantity is not None: item.quantity = update.quantity
    if update.unit_price is not None: item.unit_price = update.unit_price
    item.total = round(item.quantity * item.unit_price, 2)
    db.commit()
    return recalculate_invoice(item.invoice_id, db)

@app.delete("/invoices/items/{item_id}", response_model=schemas.InvoiceResponse)
def delete_invoice_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(models.InvoiceItem).filter(models.InvoiceItem.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    pid = item.invoice_id
    db.delete(item)
    db.commit()
    return recalculate_invoice(pid, db)

@app.post("/invoices/{invoice_id}/send")
def send_invoice_email(invoice_id: str, request: schemas.InvoiceSendRequest, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")

    abs_path = ""
    if not inv.pdf_path or not os.path.exists(os.path.join(os.getcwd(), "app", inv.pdf_path.lstrip("/"))):
        data = {
            "id": str(inv.id), "client_name": inv.account.name, "date": str(inv.generated_at.date()),
            "subtotal": inv.subtotal_amount, "gst": inv.gst_amount, "total": inv.total_amount,
            "payment_terms": inv.payment_terms,
            "items": [{"desc": i.description, "qty": i.quantity, "price": i.unit_price, "total": i.total} for i in inv.items]
        }
        pdf = pdf_engine.generate_invoice_pdf(data)
        filename = f"invoice_{inv.id}.pdf"
        abs_path = os.path.join(os.getcwd(), "app/static/reports", filename)
        pdf.output(abs_path)
        inv.pdf_path = f"/static/reports/{filename}"
        db.commit()
    else:
        abs_path = os.path.join(os.getcwd(), "app", inv.pdf_path.lstrip("/"))

    html_body = request.message or f"<p>Please find attached invoice #{str(inv.id)[:8]}.</p>"
    if "\n" in html_body and "<p>" not in html_body: html_body = html_body.replace("\n", "<br>")
    
    success = email_service.send(to_emails=[request.to_email], subject=request.subject or "Invoice", html_content=html_body, cc_emails=request.cc_emails, attachments=[abs_path])
    if not success: raise HTTPException(status_code=500, detail="Email failed")
    
    db.add(models.InvoiceDeliveryLog(invoice_id=inv.id, sent_by_user_id=current_user.id, sent_to=request.to_email, sent_cc=",".join(request.cc_emails), status="sent"))
    inv.status = 'sent'
    db.commit()
    return {"status": "sent"}

# --- PROJECT ENDPOINTS ---

@app.get("/projects", response_model=List[schemas.ProjectResponse])
def get_projects(account_id: Optional[str] = None, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Project).join(models.Account).filter(models.Project.is_deleted == False)
    if current_user.role == 'client': query = query.filter(models.Project.account_id == current_user.account_id)
    if account_id: query = query.filter(models.Project.account_id == account_id)
    projects = query.all()
    for p in projects: p.account_name = p.account.name
    return projects

@app.get("/projects/{project_id}", response_model=schemas.ProjectResponse)
def get_project_detail(project_id: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).options(joinedload(models.Project.milestones), joinedload(models.Project.account)).filter(models.Project.id == project_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    project.account_name = project.account.name
    return project

@app.post("/projects", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    new_project = models.Project(**project.model_dump())
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    new_project.account = db.query(models.Account).filter(models.Account.id == project.account_id).first()
    new_project.account_name = new_project.account.name
    return new_project

@app.put("/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: str, update: schemas.ProjectUpdate, db: Session = Depends(get_db)):
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

@app.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj: raise HTTPException(status_code=404, detail="Project not found")
    proj.is_deleted = True
    db.commit()
    return {"status": "archived"}

@app.post("/projects/{project_id}/milestones", response_model=schemas.MilestoneResponse)
def create_milestone(project_id: str, milestone: schemas.MilestoneCreate, db: Session = Depends(get_db)):
    new_milestone = models.Milestone(**milestone.model_dump(), project_id=project_id)
    db.add(new_milestone)
    db.commit()
    db.refresh(new_milestone)
    return new_milestone

@app.put("/milestones/{milestone_id}", response_model=schemas.MilestoneResponse)
def update_milestone(milestone_id: str, update: schemas.MilestoneUpdate, db: Session = Depends(get_db)):
    ms = db.query(models.Milestone).filter(models.Milestone.id == milestone_id).first()
    if not ms: raise HTTPException(status_code=404, detail="Milestone not found")
    if update.status: ms.status = update.status
    if update.name: ms.name = update.name
    if update.billable_amount is not None: ms.billable_amount = update.billable_amount
    if update.due_date: ms.due_date = update.due_date
    if update.sequence is not None: ms.sequence = update.sequence
    db.commit()
    db.refresh(ms)
    return ms

@app.post("/projects/{project_id}/milestones/reorder")
def reorder_milestones(project_id: str, payload: schemas.MilestoneReorderRequest, db: Session = Depends(get_db)):
    for item in payload.items:
        ms = db.query(models.Milestone).filter(models.Milestone.id == item.id, models.Milestone.project_id == project_id).first()
        if ms: ms.sequence = item.sequence
    db.commit()
    return {"status": "updated"}

@app.post("/milestones/{milestone_id}/invoice", response_model=schemas.InvoiceResponse)
def generate_milestone_invoice(milestone_id: str, db: Session = Depends(get_db)):
    ms = db.query(models.Milestone).join(models.Project).filter(models.Milestone.id == milestone_id).first()
    if not ms: raise HTTPException(status_code=404, detail="Milestone not found")
    if ms.billable_amount <= 0: raise HTTPException(status_code=400, detail="Nothing to bill")
    if ms.invoice_id: raise HTTPException(status_code=400, detail="Already invoiced")

    subtotal = ms.billable_amount
    gst = round(subtotal * 0.10, 2)
    total = round(subtotal + gst, 2)

    new_invoice = models.Invoice(
        account_id=ms.project.account_id, status="draft", subtotal_amount=subtotal, gst_amount=gst, total_amount=total,
        due_date=datetime.now() + timedelta(days=14), generated_at=func.now()
    )
    db.add(new_invoice)
    db.flush()

    line_item = models.InvoiceItem(
        invoice_id=new_invoice.id, description=f"Project Milestone: {ms.project.name} - {ms.name}",
        quantity=1, unit_price=subtotal, total=subtotal
    )
    db.add(line_item)
    ms.invoice_id = new_invoice.id
    ms.status = 'completed'
    db.commit()
    db.refresh(new_invoice)
    return new_invoice

# --- DEALS, AUDITS, PRODUCTS, COMMENTS ---
# (Keeping these sections brief as they are standard CRUD)

@app.get("/deals", response_model=List[schemas.DealResponse])
def get_deals(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Deal).join(models.Account)
    if current_user.role == 'client': query = query.filter(models.Account.id == current_user.account_id)
    elif current_user.access_scope == 'nt_only': query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only': query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
    deals = query.all()
    for d in deals: d.account_name = d.account.name
    return deals

@app.get("/deals/{deal_id}", response_model=schemas.DealResponse)
def get_deal_detail(deal_id: str, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal: raise HTTPException(status_code=404, detail="Deal not found")
    if current_user.access_scope == 'nt_only' and deal.account.brand_affinity == 'ds': raise HTTPException(status_code=403, detail="Forbidden")
    deal.account_name = deal.account.name
    return deal

@app.post("/deals", response_model=schemas.DealResponse)
def create_deal(deal: schemas.DealCreate, db: Session = Depends(get_db)):
    new_deal = models.Deal(**deal.model_dump())
    db.add(new_deal)
    db.commit()
    db.refresh(new_deal)
    new_deal.account_name = new_deal.account.name 
    return new_deal

@app.put("/deals/{deal_id}", response_model=schemas.DealResponse)
def update_deal(deal_id: str, deal_update: schemas.DealUpdate, db: Session = Depends(get_db)):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal: raise HTTPException(status_code=404, detail="Deal not found")
    update_data = deal_update.model_dump(exclude_unset=True)
    for key, value in update_data.items(): setattr(deal, key, value)
    db.commit()
    db.refresh(deal)
    deal.account_name = deal.account.name
    return deal

@app.get("/audits", response_model=List[schemas.AuditResponse])
def get_audits(account_id: Optional[str] = None, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.AuditReport)
    if current_user.role == 'client': query = query.filter(models.AuditReport.account_id == current_user.account_id)
    elif current_user.access_scope == 'nt_only': query = query.join(models.Account).filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only': query = query.join(models.Account).filter(models.Account.brand_affinity.in_(['ds', 'both']))
    if account_id: query = query.filter(models.AuditReport.account_id == account_id)
    return query.all()

@app.get("/audits/{audit_id}", response_model=schemas.AuditResponse)
def get_audit_detail(audit_id: str, db: Session = Depends(get_db)):
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit: raise HTTPException(status_code=404, detail="Audit not found")
    return audit

@app.post("/audits", response_model=schemas.AuditResponse)
def create_audit_draft(audit: schemas.AuditCreate, db: Session = Depends(get_db)):
    content_payload = {"items": [item.model_dump() for item in audit.items]}
    new_audit = models.AuditReport(account_id=audit.account_id, deal_id=audit.deal_id, content=content_payload, status="draft")
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
    pdf_data = { "client_name": account.name, "security_score": final_score, "infrastructure_score": final_score, "content": audit_record.content }
    filename = f"audit_{audit_id}.pdf"
    abs_path = os.path.join(os.getcwd(), "app/static/reports", filename)
    pdf = pdf_engine.generate_audit_pdf(pdf_data)
    pdf.output(abs_path)
    audit_record.security_score = final_score
    audit_record.infrastructure_score = final_score
    audit_record.status = "finalized"
    audit_record.report_pdf_path = f"/static/reports/{filename}"
    audit_record.finalized_at = func.now() 
    db.commit()
    db.refresh(audit_record)
    return audit_record

@app.get("/products", response_model=List[schemas.ProductResponse])
def get_products(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
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

# --- CAMPAIGN ENDPOINTS ---
@app.get("/campaigns", response_model=List[schemas.CampaignResponse])
def get_campaigns(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Campaign)
    if current_user.access_scope == 'nt_only': query = query.filter(models.Campaign.brand_affinity == 'nt')
    elif current_user.access_scope == 'ds_only': query = query.filter(models.Campaign.brand_affinity == 'ds')
    return query.order_by(desc(models.Campaign.created_at)).all()

@app.post("/campaigns", response_model=schemas.CampaignResponse)
def create_campaign(campaign: schemas.CampaignCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.access_scope == 'nt_only' and campaign.brand_affinity == 'ds': raise HTTPException(status_code=403, detail="Forbidden")
    new_campaign = models.Campaign(**campaign.model_dump())
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)
    return new_campaign

@app.get("/campaigns/{campaign_id}", response_model=schemas.CampaignResponse)
def get_campaign_detail(campaign_id: str, db: Session = Depends(get_db)):
    camp = db.query(models.Campaign).options(joinedload(models.Campaign.targets)).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    return camp

@app.put("/campaigns/{campaign_id}", response_model=schemas.CampaignResponse)
def update_campaign(campaign_id: str, update: schemas.CampaignUpdate, db: Session = Depends(get_db)):
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items(): setattr(camp, key, value)
    db.commit()
    db.refresh(camp)
    return camp

@app.post("/campaigns/{campaign_id}/targets/bulk", response_model=schemas.CampaignTargetAddResult)
def add_campaign_targets(campaign_id: str, filters: schemas.CampaignTargetFilter, db: Session = Depends(get_db)):
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    query = db.query(models.Contact).join(models.Account)
    if filters.account_status: query = query.filter(models.Account.status == filters.account_status)
    if filters.brand_affinity: query = query.filter(models.Account.brand_affinity.in_([filters.brand_affinity, 'both']))
    potential_contacts = query.all()
    count = 0
    for contact in potential_contacts:
        if not contact.email: continue
        exists = db.query(models.CampaignTarget).filter(models.CampaignTarget.campaign_id == campaign_id, models.CampaignTarget.contact_id == contact.id).first()
        if not exists:
            new_target = models.CampaignTarget(campaign_id=campaign_id, contact_id=contact.id, status='targeted')
            db.add(new_target)
            count += 1
    db.commit()
    return {"added_count": count, "message": f"Successfully added {count} targets."}

@app.get("/campaigns/{campaign_id}/targets", response_model=List[schemas.CampaignTargetResponse])
def get_campaign_targets(campaign_id: str, db: Session = Depends(get_db)):
    targets = db.query(models.CampaignTarget).options(joinedload(models.CampaignTarget.contact)).filter(models.CampaignTarget.campaign_id == campaign_id).all()
    results = []
    for t in targets:
        t_dict = t.__dict__.copy()
        if t.contact:
            t_dict['contact_name'] = f"{t.contact.first_name} {t.contact.last_name}"
            t_dict['contact_email'] = t.contact.email
        else: t_dict['contact_name'] = "Unknown"
        results.append(t_dict)
    return results

@app.post("/campaigns/{campaign_id}/test")
def send_campaign_test(campaign_id: str, target_email: str, db: Session = Depends(get_db)):
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    subject = camp.subject_template.replace("{{first_name}}", "TestUser").replace("{{company}}", "TestCorp")
    body = camp.body_template.replace("{{first_name}}", "TestUser").replace("{{company}}", "TestCorp")
    if "\n" in body and "<p>" not in body: body = body.replace("\n", "<br>")
    email_service.send(target_email, f"[TEST] {subject}", body)
    return {"status": "sent"}

# --- BACKGROUND PROCESSOR ---
def process_campaign_background(campaign_id: str):
    """
    Executes the campaign sending logic in a background thread.
    Creates a fresh DB session as the request session is closed.
    """
    print(f"Starting Background Campaign: {campaign_id}")
    db = SessionLocal()
    try:
        camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
        if not camp:
            print("Campaign not found in background task")
            return

        targets = db.query(models.CampaignTarget).options(
            joinedload(models.CampaignTarget.contact).joinedload(models.Contact.account)
        ).filter(
            models.CampaignTarget.campaign_id == campaign_id, 
            models.CampaignTarget.status == 'targeted'
        ).all()

        if not targets:
            print("No targets to process")
            return

        sent_count = 0
        for t in targets:
            contact = t.contact
            if not contact or not contact.email:
                t.status = 'failed'
                continue
            
            fname = contact.first_name or "Partner"
            cname = contact.account.name if contact.account else "Your Company"
            
            # Simple template replacement
            subject = camp.subject_template.replace("{{first_name}}", fname).replace("{{company}}", cname)
            body = camp.body_template.replace("{{first_name}}", fname).replace("{{company}}", cname)
            
            # HTML conversion for plain text inputs
            if "\n" in body and "<p>" not in body: 
                body = body.replace("\n", "<br>")
            
            success = email_service.send(contact.email, subject, body)
            
            if success:
                t.status = 'sent'
                t.sent_at = func.now()
                sent_count += 1
            else:
                t.status = 'failed'
                
        camp.status = 'active'
        db.commit()
        print(f"Finished Campaign {campaign_id}. Sent {sent_count} emails.")
        
    except Exception as e:
        print(f"Background Task Error: {str(e)}")
        db.rollback()
    finally:
        db.close()

@app.post("/campaigns/{campaign_id}/launch")
async def launch_campaign(
    campaign_id: str, 
    background_tasks: BackgroundTasks, 
    current_user: models.User = Depends(auth.get_current_active_user), 
    db: Session = Depends(get_db)
):
    # Validation Phase
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    if camp.status == 'completed': raise HTTPException(status_code=400, detail="Campaign already completed")
    if not camp.subject_template or not camp.body_template: raise HTTPException(status_code=400, detail="Content missing")

    pending_count = db.query(models.CampaignTarget).filter(
        models.CampaignTarget.campaign_id == campaign_id, 
        models.CampaignTarget.status == 'targeted'
    ).count()

    if pending_count == 0:
        raise HTTPException(status_code=400, detail="No pending targets.")

    # Execution Phase (Async)
    background_tasks.add_task(process_campaign_background, campaign_id)
    
    return {"status": "processing", "message": "Campaign launch initiated in background."}

# --- THE MIRROR (CLIENT PORTAL) ---
@app.get("/portal/dashboard", response_model=schemas.PortalDashboard)
def get_portal_dashboard(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role != 'client' or not current_user.account_id: raise HTTPException(status_code=403, detail="Portal access only.")
    aid = current_user.account_id
    account = db.query(models.Account).filter(models.Account.id == aid).first()
    tickets = db.query(models.Ticket).options(joinedload(models.Ticket.time_entries), joinedload(models.Ticket.materials)).filter(models.Ticket.account_id == aid, models.Ticket.is_deleted == False).order_by(desc(models.Ticket.created_at)).all()
    invoices = db.query(models.Invoice).options(joinedload(models.Invoice.items)).filter(models.Invoice.account_id == aid).order_by(desc(models.Invoice.generated_at)).all()
    projects = db.query(models.Project).options(joinedload(models.Project.milestones)).filter(models.Project.account_id == aid, models.Project.is_deleted == False).all()
    last_audit = db.query(models.AuditReport).filter(models.AuditReport.account_id == aid, models.AuditReport.status == 'finalized').order_by(desc(models.AuditReport.finalized_at)).first()
    score = last_audit.security_score if last_audit else 0
    return { "account": account, "security_score": score, "open_tickets": tickets, "invoices": invoices, "projects": projects }

# --- PUBLIC LEAD INGESTION ---
@app.post("/public/lead")
def submit_public_lead(lead: schemas.LeadSchema, db: Session = Depends(get_db)):
    new_account = models.Account(name=lead.company, type="business", status="lead", brand_affinity="ds", audit_data={"size": lead.size, "challenge": lead.challenge, "initial_message": lead.message})
    db.add(new_account)
    db.flush() 
    name_parts = lead.name.split(" ", 1)
    fname = name_parts[0]
    lname = name_parts[1] if len(name_parts) > 1 else ""
    new_contact = models.Contact(account_id=new_account.id, first_name=fname, last_name=lname, email=lead.email, is_primary_contact=True)
    db.add(new_contact)
    db.commit()
    try:
        internal_html = f"<h1>New Lead</h1><p>{lead.company}</p><p>{lead.name}</p><p>{lead.message}</p>"
        email_service.send(email_service.admin_email, f"New Lead: {lead.company}", internal_html)
        client_html = f"<p>Hi {fname},</p><p>We received your inquiry regarding {lead.company}.</p>"
        email_service.send(lead.email, "Application Received", client_html)
    except: pass
    return {"status": "received", "id": str(new_account.id)}

# --- THE LIBRARY (KNOWLEDGE BASE) ---

@app.get("/articles", response_model=List[schemas.ArticleResponse])
def get_articles(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Article)
    if category:
        query = query.filter(models.Article.category == category)
    return query.order_by(models.Article.identifier.asc()).all()

@app.get("/articles/{slug}", response_model=schemas.ArticleResponse)
def get_article_detail(slug: str, db: Session = Depends(get_db)):
    # Can look up by ID or Slug
    try:
        from uuid import UUID
        uid = UUID(slug)
        article = db.query(models.Article).filter(models.Article.id == uid).first()
    except ValueError:
        article = db.query(models.Article).filter(models.Article.slug == slug).first()
        
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    return article

@app.post("/articles", response_model=schemas.ArticleResponse)
def create_article(article: schemas.ArticleCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    new_article = models.Article(**article.model_dump(), author_id=current_user.id)
    db.add(new_article)
    db.commit()
    db.refresh(new_article)
    return new_article

@app.put("/articles/{article_id}", response_model=schemas.ArticleResponse)
def update_article(article_id: str, update: schemas.ArticleUpdate, db: Session = Depends(get_db)):
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items(): setattr(article, key, value)
    
    db.commit()
    db.refresh(article)
    return article

@app.post("/tickets/{ticket_id}/articles/{article_id}")
def link_article_to_ticket(ticket_id: int, article_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not ticket or not article: raise HTTPException(status_code=404, detail="Not found")
    
    if article not in ticket.articles:
        ticket.articles.append(article)
        db.commit()
    return {"status": "linked"}

@app.delete("/tickets/{ticket_id}/articles/{article_id}")
def unlink_article_from_ticket(ticket_id: int, article_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    
    if not ticket or not article: 
        raise HTTPException(status_code=404, detail="Not found")
    
    if article in ticket.articles:
        ticket.articles.remove(article)
        db.commit()
        
    return {"status": "unlinked"}