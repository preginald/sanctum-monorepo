from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, func, desc
from datetime import timedelta
from pydantic import BaseModel

from .database import get_db
from . import models, schemas, auth

import os
from .services import pdf_engine

from typing import List, Optional

app = FastAPI(title="Sanctum Core", version="1.2.1") # Bumped Version
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# --- CORS POLICY (The Bridge) ---
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://159.223.82.75:5173", # Your Droplet IP
    "http://core.digitalsanctum.com.au",
    "https://core.digitalsanctum.com.au",
    "https://digitalsanctum.com.au",
    "https://www.digitalsanctum.com.au",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.get("/")
def read_root():
    return {"system": "Sanctum Core", "status": "operational", "phase": "13"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"database": "connected"}

# --- PHASE 13: ANALYTICS ENGINE ---
@app.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Initialize Defaults
    revenue_realized = 0.0
    pipeline_value = 0.0
    active_audits = 0
    open_tickets = 0
    critical_tickets = 0

    # 1. REVENUE & PIPELINE (Global or Sanctum Only)
    if current_user.access_scope in ['global', 'ds_only']:
        # REVENUE: Only "Accession" (Closed Won)
        rev_q = db.query(func.sum(models.Deal.amount))\
            .filter(models.Deal.stage == 'Accession').scalar()
        revenue_realized = rev_q if rev_q else 0.0

        # PIPELINE: Everything NOT "Accession" and NOT "Lost"
        pipe_q = db.query(func.sum(models.Deal.amount))\
            .filter(models.Deal.stage != 'Accession')\
            .filter(models.Deal.stage != 'Lost').scalar()
        pipeline_value = pipe_q if pipe_q else 0.0

        # AUDITS: Active only (Draft)
        active_audits = db.query(models.AuditReport)\
            .filter(models.AuditReport.status == 'draft').count()

    # 2. TICKETS (Global or Naked Tech Only)
    if current_user.access_scope in ['global', 'nt_only']:
        # Open Tickets
        open_tickets = db.query(models.Ticket)\
            .filter(models.Ticket.status != 'resolved').count()
        
        # Critical Tickets
        critical_tickets = db.query(models.Ticket)\
            .filter(models.Ticket.status != 'resolved')\
            .filter(models.Ticket.priority == 'high').count()

    return {
        "revenue_realized": revenue_realized,
        "pipeline_value": pipeline_value,
        "active_audits": active_audits,
        "open_tickets": open_tickets,
        "critical_tickets": critical_tickets
    }

# --- AUTHENTICATION ENDPOINT ---
@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "scope": user.access_scope},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/accounts", response_model=List[schemas.AccountResponse])
def get_accounts(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Account)
    if current_user.access_scope == 'ds_only':
        query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
    elif current_user.access_scope == 'nt_only':
        query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    return query.all()

@app.post("/accounts", response_model=schemas.AccountResponse)
def create_account(
    account: schemas.AccountCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.access_scope == 'nt_only' and account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot create Brand A assets.")
    if current_user.access_scope == 'ds_only' and account.brand_affinity == 'nt':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot create Brand B assets.")

    new_account = models.Account(
        name=account.name,
        type=account.type,
        brand_affinity=account.brand_affinity,
        status=account.status,
        audit_data={}
    )
    
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account

@app.post("/contacts", response_model=schemas.ContactResponse)
def create_contact(
    contact: schemas.ContactCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    account = db.query(models.Account).filter(models.Account.id == contact.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if current_user.access_scope == 'nt_only' and account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot modify Brand A assets.")
    if current_user.access_scope == 'ds_only' and account.brand_affinity == 'nt':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot modify Brand B assets.")

    new_contact = models.Contact(
        account_id=contact.account_id,
        first_name=contact.first_name,
        last_name=contact.last_name,
        email=contact.email,
        phone=contact.phone,
        persona=contact.persona,
        reports_to_id=contact.reports_to_id,
        is_primary_contact=False
    )

    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact

# --- PUBLIC LEAD INGESTION ---
class LeadSchema(BaseModel):
    name: str
    email: str
    company: str
    size: str
    challenge: str
    message: str

@app.post("/public/lead")
def submit_public_lead(lead: LeadSchema, db: Session = Depends(get_db)):
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
    return {"status": "received", "id": str(new_account.id)}

@app.put("/accounts/{account_id}", response_model=schemas.AccountResponse)
def update_account(
    account_id: str,
    account_update: schemas.AccountUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    db_account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")

    if current_user.access_scope == 'nt_only' and db_account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.access_scope == 'ds_only' and db_account.brand_affinity == 'nt':
         raise HTTPException(status_code=403, detail="Forbidden")

    if account_update.name is not None:
        db_account.name = account_update.name
    if account_update.type is not None:
        db_account.type = account_update.type
    if account_update.status is not None:
        db_account.status = account_update.status
    
    if account_update.brand_affinity is not None:
        if current_user.access_scope == 'nt_only':
             raise HTTPException(status_code=403, detail="Insufficient clearance to change Sovereign Brand.")
        db_account.brand_affinity = account_update.brand_affinity

    db.commit()
    db.refresh(db_account)
    return db_account

@app.get("/accounts/{account_id}", response_model=schemas.AccountDetail)
def get_account_detail(
    account_id: str, 
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    account = db.query(models.Account)\
        .options(joinedload(models.Account.contacts))\
        .options(joinedload(models.Account.deals))\
        .options(joinedload(models.Account.tickets))\
        .filter(models.Account.id == account_id)\
        .first()

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if current_user.access_scope == 'nt_only' and account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Access Forbidden: Clearance Level Insufficient")

    if current_user.access_scope == 'ds_only' and account.brand_affinity == 'nt':
         raise HTTPException(status_code=403, detail="Access Forbidden: Segment Mismatch")

    return account

@app.put("/contacts/{contact_id}", response_model=schemas.ContactResponse)
def update_contact(
    contact_id: str,
    contact_update: schemas.ContactUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    db_contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    account = db.query(models.Account).filter(models.Account.id == db_contact.account_id).first()

    if current_user.access_scope == 'nt_only' and account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot modify Brand A assets.")
    if current_user.access_scope == 'ds_only' and account.brand_affinity == 'nt':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot modify Brand B assets.")

    update_data = contact_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_contact, key, value)

    db.commit()
    db.refresh(db_contact)
    return db_contact

# --- DEAL PIPELINE ENDPOINTS ---
@app.get("/deals/{deal_id}", response_model=schemas.DealResponse)
def get_deal_detail(
    deal_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    if current_user.access_scope == 'nt_only' and deal.account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.access_scope == 'ds_only' and deal.account.brand_affinity == 'nt':
        raise HTTPException(status_code=403, detail="Forbidden")

    deal.account_name = deal.account.name
    return deal

@app.get("/deals", response_model=List[schemas.DealResponse])
def get_deals(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Deal).join(models.Account)
    
    if current_user.access_scope == 'nt_only':
        query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only':
        query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
        
    deals = query.all()
    for d in deals:
        d.account_name = d.account.name
    return deals

@app.post("/deals", response_model=schemas.DealResponse)
def create_deal(
    deal: schemas.DealCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    new_deal = models.Deal(
        account_id=deal.account_id,
        title=deal.title,
        amount=deal.amount,
        stage=deal.stage,
        probability=deal.probability
    )
    db.add(new_deal)
    db.commit()
    db.refresh(new_deal)
    return new_deal

@app.put("/deals/{deal_id}", response_model=schemas.DealResponse)
def update_deal(
    deal_id: str,
    deal_update: schemas.DealUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
        
    update_data = deal_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(deal, key, value)
        
    db.commit()
    db.refresh(deal)
    return deal

# --- AUDIT ENGINE ENDPOINTS ---
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
def get_audit_detail(
    audit_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    return audit

@app.put("/audits/{audit_id}", response_model=schemas.AuditResponse)
def update_audit_content(
    audit_id: str,
    audit_update: schemas.AuditUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    
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
    else:
        final_score = 0

    audit.security_score = final_score
    audit.infrastructure_score = final_score
    audit.updated_at = func.now()
    
    db.commit()
    db.refresh(audit)
    return audit

@app.post("/audits", response_model=schemas.AuditResponse)
def create_audit_draft(
    audit: schemas.AuditCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    content_payload = {"items": [item.model_dump() for item in audit.items]}
    
    new_audit = models.AuditReport(
        account_id=audit.account_id,
        deal_id=audit.deal_id,
        content=content_payload,
        status="draft"
    )
    
    db.add(new_audit)
    db.commit()
    db.refresh(new_audit)
    return new_audit

@app.post("/audits/{audit_id}/finalize", response_model=schemas.AuditResponse)
def finalize_audit(
    audit_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    audit_record = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit_record:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    account = db.query(models.Account).filter(models.Account.id == audit_record.account_id).first()
    
    items = audit_record.content.get('items', [])
    if not items:
        raise HTTPException(status_code=400, detail="Cannot finalize empty audit")

    total_score = 0
    for item in items:
        s = item.get('status', 'green')
        if s == 'green': total_score += 100
        elif s == 'amber': total_score += 50
        elif s == 'red': total_score += 0
    
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

# --- TICKET ENDPOINTS ---
@app.get("/tickets", response_model=List[schemas.TicketResponse])
def get_tickets(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Ticket).join(models.Account)
    
    if current_user.access_scope == 'nt_only':
        query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only':
        query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
        
    tickets = query.order_by(models.Ticket.id.desc()).all()
    results = []
    for t in tickets:
        t_dict = t.__dict__
        t_dict['account_name'] = t.account.name
        
        names = [f"{c.first_name} {c.last_name}" for c in t.contacts]
        t_dict['contact_name'] = ", ".join(names) if names else None
        t_dict['contacts'] = t.contacts 
        
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
        selected_contacts = db.query(models.Contact).filter(models.Contact.id.in_(ticket.contact_ids)).all()
        new_ticket.contacts = selected_contacts
        
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
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    update_data = ticket_update.model_dump(exclude_unset=True)
    
    if 'contact_ids' in update_data:
        ids = update_data.pop('contact_ids') 
        if ids:
            new_contacts = db.query(models.Contact).filter(models.Contact.id.in_(ids)).all()
            ticket.contacts = new_contacts 
        else:
            ticket.contacts = [] 

    if 'status' in update_data and update_data['status'] == 'resolved' and ticket.status != 'resolved':
        ticket.closed_at = func.now()
        
    for key, value in update_data.items():
        setattr(ticket, key, value)
        
    db.commit()
    db.refresh(ticket)
    
    ticket.account_name = ticket.account.name
    names = [f"{c.first_name} {c.last_name}" for c in ticket.contacts]
    ticket.contact_name = ", ".join(names) if names else None
    
    return ticket

@app.get("/comments", response_model=List[schemas.CommentResponse])
def get_comments(
    ticket_id: Optional[int] = None,
    deal_id: Optional[str] = None,
    audit_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Comment)
    if ticket_id: query = query.filter(models.Comment.ticket_id == ticket_id)
    if deal_id: query = query.filter(models.Comment.deal_id == deal_id)
    if audit_id: query = query.filter(models.Comment.audit_id == audit_id)
    
    comments = query.order_by(models.Comment.created_at.desc()).all()
    
    results = []
    for c in comments:
        c.author_name = c.author.full_name
        results.append(c)
    return results

@app.post("/comments", response_model=schemas.CommentResponse)
def create_comment(
    comment: schemas.CommentCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    try:
        new_comment = models.Comment(
            author_id=current_user.id,
            body=comment.body,
            visibility=comment.visibility,
            ticket_id=comment.ticket_id,
            deal_id=comment.deal_id,
            audit_id=comment.audit_id
        )
        db.add(new_comment)
        db.commit()
        db.refresh(new_comment)
        
        new_comment.author_name = current_user.full_name or current_user.email
        
        return new_comment
    except Exception as e:
        print(f"COMMENT ERROR: {str(e)}") 
        raise HTTPException(status_code=500, detail=str(e))