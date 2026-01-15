from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db, SessionLocal
from ..services.email_service import email_service

router = APIRouter(tags=["Campaigns"])

@router.get("/campaigns", response_model=List[schemas.CampaignResponse])
def get_campaigns(current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(models.Campaign)
    if current_user.access_scope == 'nt_only': query = query.filter(models.Campaign.brand_affinity == 'nt')
    elif current_user.access_scope == 'ds_only': query = query.filter(models.Campaign.brand_affinity == 'ds')
    return query.order_by(desc(models.Campaign.created_at)).all()

@router.post("/campaigns", response_model=schemas.CampaignResponse)
def create_campaign(campaign: schemas.CampaignCreate, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    if current_user.access_scope == 'nt_only' and campaign.brand_affinity == 'ds': raise HTTPException(status_code=403, detail="Forbidden")
    new_campaign = models.Campaign(**campaign.model_dump())
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)
    return new_campaign

@router.get("/campaigns/{campaign_id}", response_model=schemas.CampaignResponse)
def get_campaign_detail(campaign_id: str, db: Session = Depends(get_db)):
    camp = db.query(models.Campaign).options(joinedload(models.Campaign.targets)).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    return camp

@router.put("/campaigns/{campaign_id}", response_model=schemas.CampaignResponse)
def update_campaign(campaign_id: str, update: schemas.CampaignUpdate, db: Session = Depends(get_db)):
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items(): setattr(camp, key, value)
    db.commit()
    db.refresh(camp)
    return camp

@router.post("/campaigns/{campaign_id}/targets/bulk", response_model=schemas.CampaignTargetAddResult)
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

@router.get("/campaigns/{campaign_id}/targets", response_model=List[schemas.CampaignTargetResponse])
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

@router.post("/campaigns/{campaign_id}/test")
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
    db = SessionLocal()
    try:
        camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
        if not camp: return
        targets = db.query(models.CampaignTarget).options(
            joinedload(models.CampaignTarget.contact).joinedload(models.Contact.account)
        ).filter(models.CampaignTarget.campaign_id == campaign_id, models.CampaignTarget.status == 'targeted').all()

        sent_count = 0
        for t in targets:
            contact = t.contact
            if not contact or not contact.email:
                t.status = 'failed'
                continue
            fname = contact.first_name or "Partner"
            cname = contact.account.name if contact.account else "Your Company"
            subject = camp.subject_template.replace("{{first_name}}", fname).replace("{{company}}", cname)
            body = camp.body_template.replace("{{first_name}}", fname).replace("{{company}}", cname)
            if "\n" in body and "<p>" not in body: body = body.replace("\n", "<br>")
            success = email_service.send(contact.email, subject, body)
            if success:
                t.status = 'sent'
                t.sent_at = func.now()
                sent_count += 1
            else:
                t.status = 'failed'
        camp.status = 'active'
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

@router.post("/campaigns/{campaign_id}/launch")
async def launch_campaign(campaign_id: str, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not camp: raise HTTPException(status_code=404, detail="Campaign not found")
    if camp.status == 'completed': raise HTTPException(status_code=400, detail="Campaign already completed")
    if not camp.subject_template or not camp.body_template: raise HTTPException(status_code=400, detail="Content missing")
    pending_count = db.query(models.CampaignTarget).filter(models.CampaignTarget.campaign_id == campaign_id, models.CampaignTarget.status == 'targeted').count()
    if pending_count == 0: raise HTTPException(status_code=400, detail="No pending targets.")
    background_tasks.add_task(process_campaign_background, campaign_id)
    return {"status": "processing", "message": "Campaign launch initiated in background."}

@router.post("/public/lead")
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