from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db
from ..services.email_service import email_service

router = APIRouter(tags=["CRM"])

# --- ACCOUNTS ---
@router.get("/accounts", response_model=List[schemas.AccountResponse])
def get_accounts(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Account)
    if current_user.role == 'client': query = query.filter(models.Account.id == current_user.account_id)
    elif current_user.access_scope == 'ds_only': query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
    elif current_user.access_scope == 'nt_only': query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    return query.all()

@router.get("/accounts/{account_id}", response_model=schemas.AccountDetail)
def get_account_detail(account_id: str, db: Session = Depends(get_db)):
    account = db.query(models.Account)\
        .options(joinedload(models.Account.contacts), joinedload(models.Account.deals), joinedload(models.Account.projects), joinedload(models.Account.invoices), joinedload(models.Account.tickets).joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.user))\
        .filter(models.Account.id == account_id).first()
    if not account: raise HTTPException(status_code=404, detail="Account not found")
    account.projects = [p for p in account.projects if not p.is_deleted]
    account.tickets = [t for t in account.tickets if not t.is_deleted]
    return account

@router.post("/accounts", response_model=schemas.AccountResponse)
def create_account(account: schemas.AccountCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    new_account = models.Account(**account.model_dump(), audit_data={})
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account

@router.put("/accounts/{account_id}", response_model=schemas.AccountResponse)
def update_account(account_id: str, account_update: schemas.AccountUpdate, db: Session = Depends(get_db)):
    db_account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not db_account: raise HTTPException(status_code=404, detail="Account not found")
    update_data = account_update.model_dump(exclude_unset=True)
    for key, value in update_data.items(): setattr(db_account, key, value)
    db.commit()
    db.refresh(db_account)
    return db_account

# --- USERS ---
@router.post("/accounts/{account_id}/users", response_model=schemas.UserResponse)
def create_client_user(account_id: str, user_data: schemas.ClientUserCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    if db.query(models.User).filter(models.User.email == user_data.email).first(): raise HTTPException(status_code=400, detail="Email already registered")
    hashed_pw = auth.get_password_hash(user_data.password)
    new_user = models.User(email=user_data.email, password_hash=hashed_pw, full_name=user_data.full_name, role="client", access_scope="restricted", account_id=account_id)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    try: email_service.send(user_data.email, "Portal Access Granted", f"Welcome {user_data.full_name}. Login: {user_data.email}")
    except: pass
    return new_user

@router.get("/accounts/{account_id}/users", response_model=List[schemas.UserResponse])
def get_client_users(account_id: str, db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.account_id == account_id).all()

@router.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}

# --- DEALS ---
@router.get("/deals", response_model=List[schemas.DealResponse])
def get_deals(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Deal).join(models.Account)
    if current_user.role == 'client': query = query.filter(models.Account.id == current_user.account_id)
    elif current_user.access_scope == 'nt_only': query = query.filter(models.Account.brand_affinity.in_(['nt', 'both']))
    elif current_user.access_scope == 'ds_only': query = query.filter(models.Account.brand_affinity.in_(['ds', 'both']))
    deals = query.all()
    for d in deals: d.account_name = d.account.name
    return deals

@router.get("/deals/{deal_id}", response_model=schemas.DealResponse)
def get_deal_detail(deal_id: str, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal: raise HTTPException(status_code=404, detail="Deal not found")
    if current_user.access_scope == 'nt_only' and deal.account.brand_affinity == 'ds': raise HTTPException(status_code=403, detail="Forbidden")
    deal.account_name = deal.account.name
    return deal

@router.post("/deals", response_model=schemas.DealResponse)
def create_deal(deal: schemas.DealCreate, db: Session = Depends(get_db)):
    new_deal = models.Deal(**deal.model_dump())
    db.add(new_deal)
    db.commit()
    db.refresh(new_deal)
    new_deal.account_name = new_deal.account.name 
    return new_deal

@router.put("/deals/{deal_id}", response_model=schemas.DealResponse)
def update_deal(deal_id: str, deal_update: schemas.DealUpdate, db: Session = Depends(get_db)):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal: raise HTTPException(status_code=404, detail="Deal not found")
    update_data = deal_update.model_dump(exclude_unset=True)
    for key, value in update_data.items(): setattr(deal, key, value)
    db.commit()
    db.refresh(deal)
    deal.account_name = deal.account.name
    return deal

# --- PRODUCTS ---
@router.get("/products", response_model=List[schemas.ProductResponse])
def get_products(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': return []
    return db.query(models.Product).filter(models.Product.is_active == True).all()

@router.post("/products", response_model=schemas.ProductResponse)
def create_product(product: schemas.ProductCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.access_scope != 'global': raise HTTPException(status_code=403, detail="Forbidden")
    new_product = models.Product(**product.model_dump())
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

@router.delete("/products/{product_id}")
def archive_product(product_id: str, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.access_scope != 'global': raise HTTPException(status_code=403, detail="Forbidden")
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product: raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()
    return {"status": "archived"}

# --- CONTACTS ---
@router.post("/contacts", response_model=schemas.ContactResponse)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    new_contact = models.Contact(**contact.model_dump())
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact

@router.put("/contacts/{contact_id}", response_model=schemas.ContactResponse)
def update_contact(contact_id: str, contact_update: schemas.ContactUpdate, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact: raise HTTPException(status_code=404, detail="Contact not found")
    update_data = contact_update.model_dump(exclude_unset=True)
    for key, value in update_data.items(): setattr(contact, key, value)
    db.commit()
    db.refresh(contact)
    return contact

@router.delete("/contacts/{contact_id}")
def delete_contact(contact_id: str, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact: raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
    return {"status": "deleted"}