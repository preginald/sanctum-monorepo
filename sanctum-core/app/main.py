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

app = FastAPI(title="Sanctum Core", version="1.5.1")
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

# --- ACCOUNT ENDPOINTS ---
@app.get("/accounts", response_model=List[schemas.AccountResponse])
def get_accounts(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    return db.query(models.Account).all()

@app.get("/accounts/{account_id}", response_model=schemas.AccountDetail)
def get_account_detail(account_id: str, db: Session = Depends(get_db)):
    account = db.query(models.Account)\
        .options(joinedload(models.Account.contacts))\
        .options(joinedload(models.Account.deals))\
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

# --- TICKET ENDPOINTS ---
@app.get("/tickets", response_model=List[schemas.TicketResponse])
def get_tickets(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Ticket)\
        .join(models.Account)\
        .options(
            joinedload(models.Ticket.time_entries)
            .joinedload(models.TicketTimeEntry.user)
        )
    
    tickets = query.order_by(models.Ticket.id.desc()).all()
    
    results = []
    for t in tickets:
        t_dict = t.__dict__.copy() 
        t_dict['account_name'] = t.account.name
        
        names = [f"{c.first_name} {c.last_name}" for c in t.contacts]
        t_dict['contact_name'] = ", ".join(names) if names else None
        t_dict['contacts'] = t.contacts 
        t_dict['total_hours'] = t.total_hours
        t_dict['time_entries'] = t.time_entries 
        
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
    ticket = db.query(models.Ticket)\
        .options(
            joinedload(models.Ticket.time_entries)
            .joinedload(models.TicketTimeEntry.user)
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
        description=entry.description
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    
    # Reload user for proper serialization
    # Explicitly fetching from DB to ensure user object is attached for 'user_name' property
    new_entry.user = db.query(models.User).filter(models.User.id == current_user.id).first()
    
    return new_entry

@app.delete("/tickets/{ticket_id}/time_entries/{entry_id}")
def delete_time_entry(ticket_id: int, entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(models.TicketTimeEntry).filter(
        models.TicketTimeEntry.id == entry_id,
        models.TicketTimeEntry.ticket_id == ticket_id
    ).first()
    if not entry: raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"status": "deleted"}