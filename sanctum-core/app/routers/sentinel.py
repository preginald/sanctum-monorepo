from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from uuid import UUID
from .. import models, database
from typing import Optional, Dict, List
from datetime import datetime

import json
import os
from ..models import Deal, DealItem, Product

CONFIG_PATH = os.path.join(os.path.dirname(__file__), '../../config/control_product_mappings.json')

def load_control_mappings():
    """Load control→product mappings from JSON config file."""
    try:
        with open(CONFIG_PATH, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"⚠️  Warning: Mapping file not found at {CONFIG_PATH}")
        return {}
    except json.JSONDecodeError as e:
        print(f"⚠️  Warning: Invalid JSON in mapping file: {e}")
        return {}

class TemplateListResponse(BaseModel):
    id: UUID
    name: str
    framework: str
    description: Optional[str]
    category_structure: Optional[List[Dict]]
    
    class Config:
        from_attributes = True

class AuditSubmissionRequest(BaseModel):
    template_id: UUID
    responses: Dict[str, Dict[str, str]]  # {control_id: {status: "pass/fail/partial/na", notes: "..."}}

class AuditDetailResponse(BaseModel):
    id: UUID
    account_id: UUID
    template_id: Optional[UUID]
    security_score: int
    status: str
    template_name: Optional[str]
    responses: Optional[Dict[str, Dict[str, str]]]
    category_structure: Optional[List[Dict]]
    
    class Config:
        from_attributes = True

router = APIRouter(prefix="/sentinel", tags=["Sentinel"])

class DeepScanRequest(BaseModel):
    audit_id: UUID
    target_url: str

@router.get("/templates", response_model=List[TemplateListResponse])
def list_audit_templates(db: Session = Depends(database.get_db)):
    """
    Returns all active audit templates (Essential 8, NIST CSF, etc.)
    """
    templates = db.query(models.AuditTemplate).filter(
        models.AuditTemplate.is_active == True
    ).all()
    
    return templates

@router.post("/scan")
def queue_sentinel_scan(payload: DeepScanRequest, db: Session = Depends(database.get_db)):
    """
    Queues a background deep scan for the Sentinel Engine.
    The worker will pick this up and perform SSL, DNS, SEO, and Tech checks.
    """
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == payload.audit_id).first()
    
    if not audit:
        raise HTTPException(status_code=404, detail="Audit report not found")

    if audit.status == 'finalized':
        raise HTTPException(status_code=400, detail="Cannot scan a finalized report")

    # Update state for the background worker
    audit.target_url = payload.target_url
    audit.scan_status = 'queued'
    
    db.commit()
    
    return {"status": "queued", "message": f"Scan initiated for {payload.target_url}"}

@router.get("/status/{audit_id}")
def get_scan_status(audit_id: UUID, db: Session = Depends(database.get_db)):
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
        
    return {
        "audit_id": audit_id,
        "scan_status": audit.scan_status,
        "last_scan_at": audit.last_scan_at
    }

@router.get("/audits/{audit_id}", response_model=AuditDetailResponse)
def get_audit_detail(audit_id: UUID, db: Session = Depends(database.get_db)):
    """
    Returns audit report with template structure and submitted responses.
    """
    audit = db.query(models.AuditReport).filter(
        models.AuditReport.id == audit_id
    ).first()
    
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    # Get submission if exists
    submission = db.query(models.AuditSubmission).filter(
        models.AuditSubmission.audit_report_id == audit_id
    ).first()
    
    # Get template details
    template_name = None
    category_structure = None
    responses = None
    
    if audit.template_id:
        template = db.query(models.AuditTemplate).filter(
            models.AuditTemplate.id == audit.template_id
        ).first()
        if template:
            template_name = template.name
            category_structure = template.category_structure
    
    if submission:
        responses = submission.responses
    
    return {
        "id": audit.id,
        "account_id": audit.account_id,
        "template_id": audit.template_id,
        "security_score": audit.security_score,
        "status": audit.status,
        "template_name": template_name,
        "category_structure": category_structure,
        "responses": responses
    }

@router.post("/audits/{audit_id}/submit")
def submit_audit_responses(
    audit_id: UUID,
    payload: AuditSubmissionRequest,
    db: Session = Depends(database.get_db)
):
    """
    Submits or updates audit responses and recalculates security score.
    """
    from ..auth import get_current_user
    
    audit = db.query(models.AuditReport).filter(
        models.AuditReport.id == audit_id
    ).first()
    
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    if audit.status == 'finalized':
        raise HTTPException(status_code=400, detail="Cannot modify finalized audit")
    
    # Get template to validate controls and calculate score
    template = db.query(models.AuditTemplate).filter(
        models.AuditTemplate.id == payload.template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Calculate weighted score
    total_weight = 0
    earned_weight = 0.0
    
    for category in template.category_structure:
        for control in category.get('controls', []):
            control_id = control['id']
            weight = control.get('weight', 1)
            
            response = payload.responses.get(control_id, {})
            status = response.get('status', 'fail')
            
            if status != 'na':  # Exclude N/A from scoring
                total_weight += weight
                
                if status == 'pass':
                    earned_weight += weight
                elif status == 'partial':
                    earned_weight += (weight * 0.5)
    
    # Calculate percentage
    security_score = 0
    if total_weight > 0:
        security_score = int((earned_weight / total_weight) * 100)
    
    # Update audit report
    audit.template_id = payload.template_id
    audit.security_score = security_score
    
    # Create or update submission
    submission = db.query(models.AuditSubmission).filter(
        models.AuditSubmission.audit_report_id == audit_id
    ).first()
    
    if submission:
        submission.template_id = payload.template_id
        submission.responses = payload.responses
        submission.updated_at = datetime.utcnow()
    else:
        submission = models.AuditSubmission(
            audit_report_id=audit_id,
            template_id=payload.template_id,
            responses=payload.responses
        )
        db.add(submission)
    
    db.commit()
    db.refresh(audit)
    
    return {
        "audit_id": audit_id,
        "security_score": security_score,
        "status": "success"
    }

@router.post("/audits/{audit_id}/generate-deal")
def generate_remediation_deal(
    audit_id: UUID,
    db: Session = Depends(database.get_db)
):
    """
    Auto-generate a Deal with DealItems for failed audit controls.
    Maps controls to remediation products via config/control_product_mappings.json.
    """
    
    # Get audit with responses
    audit = db.query(models.AuditReport).filter(
        models.AuditReport.id == audit_id
    ).first()
    
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    if not audit.template_id:
        raise HTTPException(status_code=400, detail="Audit has no template")
    
    # Get template structure
    template = db.query(models.AuditTemplate).filter(
        models.AuditTemplate.id == audit.template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get submission responses
    submission = db.query(models.AuditSubmission).filter(
        models.AuditSubmission.audit_report_id == audit_id
    ).first()
    
    if not submission:
        raise HTTPException(status_code=404, detail="No audit responses found")
    
    responses = submission.responses
    
    # Load mappings
    mappings = load_control_mappings()
    framework_key = template.framework.lower().replace('-', '')  # "Essential8" -> "essential8"
    framework_mappings = mappings.get(framework_key, {})
    
    if not framework_mappings:
        raise HTTPException(
            status_code=500,
            detail=f"No product mappings found for framework: {template.framework}"
        )
    
    # Collect failed/partial controls
    failed_controls = []
    
    for category in template.category_structure:
        for control in category.get('controls', []):
            control_id = control['id']
            response = responses.get(control_id, {})
            status = response.get('status', 'fail')
            
            if status in ['fail', 'partial']:
                failed_controls.append({
                    'control_id': control_id,
                    'control_name': control['name'],
                    'status': status,
                    'category': category['category']
                })
    
    if not failed_controls:
        raise HTTPException(
            status_code=400, 
            detail="No failed controls to remediate. Audit score is excellent!"
        )
    
    # Map controls to products
    deal_items_data = []
    added_products = {}  # Track product→quantity to consolidate duplicates
    
    for control in failed_controls:
        control_id = control['control_id']
        
        # Get products for this control from config
        product_mappings = framework_mappings.get(control_id, [])
        
        if not product_mappings:
            # No mapping found - log and skip
            print(f"⚠️  No product mapping for control: {control_id}")
            continue
        
        for mapping in product_mappings:
            product_name = mapping['product_name']
            quantity = mapping.get('quantity', 1)
            
            # Fetch product from database
            product = db.query(Product).filter(
                Product.name == product_name,
                Product.is_active == True
            ).first()
            
            if not product:
                print(f"⚠️  Product not found in catalog: {product_name}")
                continue
            
            # Consolidate quantities for duplicate products
            product_key = str(product.id)
            if product_key in added_products:
                added_products[product_key]['quantity'] += quantity
            else:
                added_products[product_key] = {
                    'product_id': product.id,
                    'product_name': product.name,
                    'quantity': quantity,
                    'unit_price': product.unit_price
                }
    
    if not added_products:
        raise HTTPException(
            status_code=404,
            detail="Could not map failed controls to products. Check catalog and mappings."
        )
    
    # Convert to list and calculate totals
    for item_data in added_products.values():
        item_data['total'] = float(item_data['unit_price']) * item_data['quantity']
        deal_items_data.append(item_data)
    
    # Calculate deal total
    deal_amount = sum(item['total'] for item in deal_items_data)
    
    # Create Deal
    new_deal = Deal(
        account_id=audit.account_id,
        title=f"Security Remediation - {template.name}",
        amount=deal_amount,
        stage='Infiltration',
        probability=50
    )
    db.add(new_deal)
    db.flush()  # Get deal ID
    
    # Create DealItems
    for item_data in deal_items_data:
        deal_item = DealItem(
            deal_id=new_deal.id,
            product_id=item_data['product_id'],
            quantity=item_data['quantity'],
            override_price=None  # Use catalog price
        )
        db.add(deal_item)
    
    # Link deal to audit
    audit.deal_id = new_deal.id
    
    db.commit()
    db.refresh(new_deal)
    
    return {
        "deal_id": str(new_deal.id),
        "deal_amount": float(deal_amount),
        "items_count": len(deal_items_data),
        "failed_controls_count": len(failed_controls),
        "message": f"Created remediation deal with {len(deal_items_data)} line items"
    }