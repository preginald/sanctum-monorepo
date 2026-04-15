from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy import func
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db
from ..services.email_service import email_service
from ..services.auth_service import auth_service
from ..services.portal_provisioning import provision_portal_user
from ..services.uuid_resolver import resolve_uuid, get_or_404


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
    account = get_or_404(db, models.Account, account_id, options=[
        joinedload(models.Account.contacts), joinedload(models.Account.deals), joinedload(models.Account.projects), joinedload(models.Account.invoices), joinedload(models.Account.tickets).joinedload(models.Ticket.time_entries).joinedload(models.TicketTimeEntry.user), joinedload(models.Account.assets)
    ], deleted_filter=False)
    account.projects = [p for p in account.projects if not p.is_deleted]
    account.tickets = [t for t in account.tickets if not t.is_deleted]
    for t in account.tickets:
        set_committed_value(t, 'related_tickets', [])
        set_committed_value(t, 'comments', [])

    # Load linked artefacts (graceful if table doesn't exist yet)
    try:
        artefact_ids = db.query(models.ArtefactLink.artefact_id).filter(
            models.ArtefactLink.linked_entity_type == "account",
            models.ArtefactLink.linked_entity_id == str(account.id),
        ).all()
        if artefact_ids:
            ids = [r[0] for r in artefact_ids]
            account.artefacts = db.query(models.Artefact).filter(
                models.Artefact.id.in_(ids), models.Artefact.is_deleted == False
            ).all()
    except Exception:
        db.rollback()

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
    db_account = get_or_404(db, models.Account, account_id, deleted_filter=False)

    update_data = account_update.model_dump(exclude_unset=True)

    # Logic Fix: Sync brand_affinity with type if type is being changed
    # but brand_affinity wasn't explicitly provided in the payload.
    if "type" in update_data and "brand_affinity" not in update_data:
        if update_data["type"] == "business":
            update_data["brand_affinity"] = "ds"
        elif update_data["type"] == "residential":
            update_data["brand_affinity"] = "nt"

    for key, value in update_data.items():
        setattr(db_account, key, value)

    db.commit()
    db.refresh(db_account)
    return db_account

# --- USERS ---
@router.post("/accounts/{account_id}/users", response_model=schemas.UserResponse)
def create_client_user(account_id: str, user_data: schemas.ClientUserCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    if db.query(models.User).filter(models.User.email == user_data.email).first(): raise HTTPException(status_code=400, detail="Email already registered")
    new_user = models.User(email=user_data.email, password_hash=None, full_name=user_data.full_name, role="client", access_scope="restricted", account_id=account_id)
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
    user = get_or_404(db, models.User, user_id, deleted_filter=False)
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
    deal = get_or_404(db, models.Deal, deal_id, options=[
        joinedload(models.Deal.items).joinedload(models.DealItem.product)
    ], deleted_filter=False)

    if current_user.access_scope == 'nt_only' and deal.account.brand_affinity == 'ds':
        raise HTTPException(status_code=403, detail="Forbidden")

    # Build items list
    items_data = []
    for item in deal.items:
        unit_price = item.override_price if item.override_price else item.product.unit_price
        total = float(unit_price) * item.quantity

        items_data.append({
            'id': item.id,
            'product_id': item.product_id,
            'product_name': item.product.name,
            'quantity': item.quantity,
            'override_price': item.override_price,
            'unit_price': unit_price,
            'total': total
        })

    # Return response dict (Pydantic will validate)
    return {
        'id': deal.id,
        'account_id': deal.account_id,
        'title': deal.title,
        'amount': deal.amount,
        'stage': deal.stage,
        'probability': deal.probability,
        'expected_close_date': deal.expected_close_date,
        'account_name': deal.account.name,
        'source_campaign_id': deal.source_campaign_id,
        'campaign_name': None,
        'items': items_data
    }

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
    deal = get_or_404(db, models.Deal, deal_id, deleted_filter=False)
    update_data = deal_update.model_dump(exclude_unset=True)
    for key, value in update_data.items(): setattr(deal, key, value)
    db.commit()
    db.refresh(deal)
    deal.account_name = deal.account.name
    return deal

# --- PRODUCTS ---
@router.get("/products", response_model=List[schemas.ProductResponse])
def get_products(product_type: str | None = None, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': return []
    query = db.query(models.Product).filter(models.Product.is_active == True)
    if product_type:
        query = query.filter(models.Product.type == product_type)
    return query.all()

@router.get("/products/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: str, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    product = get_or_404(db, models.Product, product_id, deleted_filter=False)
    return product

@router.post("/products", response_model=schemas.ProductResponse)
def create_product(product: schemas.ProductCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.access_scope != 'global': raise HTTPException(status_code=403, detail="Forbidden")
    new_product = models.Product(**product.model_dump())
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

@router.put("/products/{product_id}", response_model=schemas.ProductResponse)
def update_product(product_id: str, product_update: schemas.ProductUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    if current_user.access_scope != 'global': raise HTTPException(status_code=403, detail="Forbidden")

    product = get_or_404(db, models.Product, product_id, deleted_filter=False)

    # Update fields
    update_data = product_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)

    # Logic Fix: If turning off recurring, clear frequency
    if product.is_recurring is False:
        product.billing_frequency = None

    db.commit()
    db.refresh(product)
    return product

@router.delete("/products/{product_id}")
def archive_product(product_id: str, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.access_scope != 'global': raise HTTPException(status_code=403, detail="Forbidden")
    product = get_or_404(db, models.Product, product_id, deleted_filter=False)
    product.is_active = False
    db.commit()
    return {"status": "archived"}

# --- CONTACTS ---
@router.get("/contacts", response_model=List[schemas.ContactResponse])
def list_contacts(account_id: Optional[str] = None, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Contact)
    if account_id:
        query = query.filter(models.Contact.account_id == account_id)
    return query.order_by(models.Contact.first_name).all()

@router.post("/contacts", response_model=schemas.ContactResponse)
def create_contact(contact: schemas.ContactCreate, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    contact_data = contact.model_dump()
    enable_portal = contact_data.pop('enable_portal_access', False)

    # 1. PREVENT DUPLICATE CONTACTS
    if contact.email:
        existing_contact = db.query(models.Contact).filter(
            models.Contact.account_id == contact.account_id,
            models.Contact.email == contact.email
        ).first()
        if existing_contact:
            raise HTTPException(status_code=400, detail="A contact with this email already exists for this client.")

    # 2. Set portal_access BEFORE db.add() so the column is correct from creation
    if enable_portal:
        contact_data['portal_access'] = True

    # 3. Create Contact
    new_contact = models.Contact(**contact_data)
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)

    # 4. Convergence Logic (Delegated to shared service)
    provisioning_result = None
    if enable_portal:
        provisioning_result = provision_portal_user(db, new_contact, background_tasks)

    # Attach provisioning result to response (transient, not persisted)
    response = new_contact
    if provisioning_result:
        response.provisioning_result = provisioning_result

    return response

@router.put("/contacts/{contact_id}", response_model=schemas.ContactResponse)
def update_contact(contact_id: str, contact_update: schemas.ContactUpdate, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    contact = get_or_404(db, models.Contact, contact_id, deleted_filter=False)

    update_data = contact_update.model_dump(exclude_unset=True)
    enable_portal = update_data.pop('enable_portal_access', None)

    # Apply field updates
    for key, value in update_data.items():
        setattr(contact, key, value)

    # Provisioning: detect false-to-true transition
    provisioning_result = None
    if enable_portal is True and not contact.portal_access:
        contact.portal_access = True
        provisioning_result = provision_portal_user(db, contact, background_tasks)
        if provisioning_result.get("status") == "error":
            # Rollback portal_access so contact isn't stuck in a bad state
            db.rollback()
            db.refresh(contact)
        else:
            db.commit()
            db.refresh(contact)
    elif enable_portal is False:
        contact.portal_access = False
        db.commit()
        db.refresh(contact)
    else:
        db.commit()
        db.refresh(contact)

    if provisioning_result:
        contact.provisioning_result = provisioning_result

    return contact

@router.delete("/contacts/{contact_id}")
def delete_contact(contact_id: str, db: Session = Depends(get_db)):
    contact = get_or_404(db, models.Contact, contact_id, deleted_filter=False)
    db.delete(contact)
    db.commit()
    return {"status": "deleted"}
