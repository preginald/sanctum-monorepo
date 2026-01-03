from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, func
from datetime import timedelta
from pydantic import BaseModel

from .database import get_db
from . import models, schemas, auth

import os
from .services import pdf_engine

app = FastAPI(title="Sanctum Core", version="1.1.0")
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

# This tells FastAPI where to look for the token URL
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.get("/")
def read_root():
    return {"system": "Sanctum Core", "status": "operational"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"database": "connected"}

@app.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    current_user: models.User = Depends(auth.get_current_active_user), # We need to create this dependency
    db: Session = Depends(get_db)
):
    # 1. Initialize Defaults
    revenue = 0.0
    audits = 0
    tickets = 0

    # 2. BIFURCATION LOGIC
    # If Global or Digital Sanctum (ds_only), calculate Revenue
    if current_user.access_scope in ['global', 'ds_only']:
        revenue_query = db.query(func.sum(models.Deal.amount)).scalar()
        revenue = revenue_query if revenue_query else 0.0

        audits = db.query(models.AuditReport).count()

    # If Global or Naked Tech (nt_only), calculate Tickets
    if current_user.access_scope in ['global', 'nt_only']:
        tickets = db.query(models.Ticket).filter(models.Ticket.status != 'resolved').count()

    return {
        "revenue_mtd": revenue,
        "active_audits": audits,
        "open_tickets": tickets
    }

# --- AUTHENTICATION ENDPOINT ---
@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Fetch user by email
    user = db.query(models.User).filter(models.User.email == form_data.username).first()

    # 2. Validate User and Password
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Generate Token
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "scope": user.access_scope},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}

from typing import List

@app.get("/accounts", response_model=List[schemas.AccountResponse])
def get_accounts(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Account)

    # BIFURCATION FILTERING
    if current_user.access_scope == 'ds_only':
        # Show Digital Sanctum AND Shared accounts
        query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))

    elif current_user.access_scope == 'nt_only':
        # Show Naked Tech AND Shared accounts
        query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))

    # 'global' sees everything

    return query.all()

@app.post("/accounts", response_model=schemas.AccountResponse)
def create_account(
    account: schemas.AccountCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # 1. ENFORCE SOVEREIGNTY (Creation Permissions)
    # A Naked Tech user can only create 'nt' or 'both'. Never 'ds'.
    if current_user.access_scope == 'nt_only' and account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot create Brand A assets.")
    
    # A Digital Sanctum user can only create 'ds' or 'both'. Never 'nt'.
    if current_user.access_scope == 'ds_only' and account.brand_affinity == 'nt':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot create Brand B assets.")

    # 2. Create Object
    new_account = models.Account(
        name=account.name,
        type=account.type,
        brand_affinity=account.brand_affinity,
        status=account.status,
        audit_data={} # Empty by default
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
    # 1. Verify Parent Account Exists & Check Permissions
    account = db.query(models.Account).filter(models.Account.id == contact.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # 2. Enforce Brand Sovereignty
    if current_user.access_scope == 'nt_only' and account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot modify Brand A assets.")
    if current_user.access_scope == 'ds_only' and account.brand_affinity == 'nt':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot modify Brand B assets.")

    # 3. Create Contact
    new_contact = models.Contact(
        account_id=contact.account_id,
        first_name=contact.first_name,
        last_name=contact.last_name,
        email=contact.email,
        phone=contact.phone,
        persona=contact.persona,
        reports_to_id=contact.reports_to_id,
        is_primary_contact=False # Default
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
    # 1. Create the Account (Company)
    new_account = models.Account(
        name=lead.company,
        type="business",
        status="lead",         # Mark as Lead
        brand_affinity="ds",   # It came from Digital Sanctum site
        audit_data={           # Store the extra form data here
            "size": lead.size,
            "challenge": lead.challenge,
            "initial_message": lead.message
        }
    )
    db.add(new_account)
    db.flush() # Generate the ID

    # 2. Split Name (Simple logic)
    name_parts = lead.name.split(" ", 1)
    fname = name_parts[0]
    lname = name_parts[1] if len(name_parts) > 1 else ""

    # 3. Create the Contact (Person)
    new_contact = models.Contact(
        account_id=new_account.id,
        first_name=fname,
        last_name=lname,
        email=lead.email,
        is_primary_contact=True
    )
    db.add(new_contact)

    # 4. Commit
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

    # SECURITY: Brand Sovereignty
    if current_user.access_scope == 'nt_only' and db_account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.access_scope == 'ds_only' and db_account.brand_affinity == 'nt':
         raise HTTPException(status_code=403, detail="Forbidden")

    # UPDATE LOGIC
    if account_update.name is not None:
        db_account.name = account_update.name
    if account_update.type is not None:
        db_account.type = account_update.type
    if account_update.status is not None:
        db_account.status = account_update.status
    
    # PRIORITY 2: BRAND MUTABILITY (Restricted)
    if account_update.brand_affinity is not None:
        # Only Global (CEO) or Sanctum (Strategists) can move assets. 
        # Naked Tech (Technicians) cannot re-assign sovereignty.
        if current_user.access_scope == 'nt_only':
             raise HTTPException(status_code=403, detail="Insufficient clearance to change Sovereign Brand.")
        db_account.brand_affinity = account_update.brand_affinity

    db.commit()
    db.refresh(db_account)
    return db_account

@app.get("/accounts/{account_id}", response_model=schemas.AccountDetail)
def get_account_detail(
    account_id: str, # We use str to parse the UUID safely
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch the Account (Force load contacts, deals, tickets)
    account = db.query(models.Account)\
        .options(joinedload(models.Account.contacts))\
        .options(joinedload(models.Account.deals))\
        .options(joinedload(models.Account.tickets))\
        .filter(models.Account.id == account_id)\
        .first()

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # 2. ENFORCE BIFURCATION SECURITY
    # If user is 'nt_only' (Tech) AND account is 'ds' (Sanctum), BLOCK THEM.
    if current_user.access_scope == 'nt_only' and account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Access Forbidden: Clearance Level Insufficient")

    # If user is 'ds_only' AND account is 'nt', BLOCK THEM.
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
    # 1. Fetch Contact
    db_contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    # 2. Fetch Parent Account for Permission Check
    account = db.query(models.Account).filter(models.Account.id == db_contact.account_id).first()

    # 3. Enforce Brand Sovereignty
    if current_user.access_scope == 'nt_only' and account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot modify Brand A assets.")
    if current_user.access_scope == 'ds_only' and account.brand_affinity == 'nt':
        raise HTTPException(status_code=403, detail="Forbidden: Cannot modify Brand B assets.")

    # 4. Apply Updates
    # Loop through fields to avoid repetitive if statements
    update_data = contact_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_contact, key, value)

    # 5. Commit
    db.commit()
    db.refresh(db_contact)
    return db_contact

# --- DEAL PIPELINE ENDPOINTS ---

@app.get("/deals", response_model=List[schemas.DealResponse])
def get_deals(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Deal).join(models.Account)
    
    # BIFURCATION: Techs don't see Deal Pipelines usually, but if they do:
    if current_user.access_scope == 'nt_only':
        query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only':
        query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
        
    return query.all()

@app.post("/deals", response_model=schemas.DealResponse)
def create_deal(
    deal: schemas.DealCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check permissions logic here if needed (omitted for brevity, similar to Accounts)
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
        
    # Apply all updates
    update_data = deal_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(deal, key, value)
        
    db.commit()
    db.refresh(deal)
    return deal

# --- AUDIT ENGINE ENDPOINTS ---

@app.post("/audits", response_model=schemas.AuditResponse)
def create_audit_draft(
    audit: schemas.AuditCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # 1. Validation
    if current_user.access_scope == 'nt_only':
        # Tech check logic here if needed (omitted for brevity)
        pass

    # 2. Create Object
    # We dump the items list into the JSONB column
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
    # 1. Fetch Audit & Account
    audit_record = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit_record:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    account = db.query(models.Account).filter(models.Account.id == audit_record.account_id).first()
    
    # 2. Calculate Scores (The Algorithm)
    # Red = 0, Amber = 50, Green = 100
    items = audit_record.content.get('items', [])
    if not items:
        raise HTTPException(status_code=400, detail="Cannot finalize empty audit")

    total_score = 0
    for item in items:
        s = item.get('status', 'green')
        if s == 'green': total_score += 100
        elif s == 'amber': total_score += 50
        elif s == 'red': total_score += 0
    
    # Simple average for now (can be split by category later)
    final_score = int(total_score / len(items))
    
    # 3. Generate PDF
    # Prepare data for the engine
    pdf_data = {
        "client_name": account.name,
        "security_score": final_score,
        "infrastructure_score": final_score, # Using same score for now
        "content": audit_record.content
    }
    
    # Define Path
    filename = f"audit_{audit_id}.pdf"
    output_path = os.path.join("app/static/reports", filename)
    
    # Draw it
    pdf = pdf_engine.generate_audit_pdf(pdf_data)
    pdf.output(output_path)
    
    # 4. Save to DB
    audit_record.security_score = final_score
    audit_record.infrastructure_score = final_score
    audit_record.status = "finalized"
    audit_record.report_pdf_path = f"/static/reports/{filename}"
    
    db.commit()
    db.refresh(audit_record)
    return audit_record