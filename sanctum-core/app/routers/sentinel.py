from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from uuid import UUID
from .. import models, database, auth
from typing import Optional, Dict, List
from datetime import datetime

import json
import logging
import os
from ..models import Deal, DealItem, Product

logger = logging.getLogger(__name__)

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
    scan_mode: Optional[str] = None

    class Config:
        from_attributes = True

class ScanRequest(BaseModel):
    asset_id: Optional[UUID] = None

class AuditSubmissionRequest(BaseModel):
    template_id: UUID
    responses: Dict[str, Dict[str, str]]  # {control_id: {status: "pass/fail/partial/na", notes: "..."}}

class WebsiteAssetBrief(BaseModel):
    id: UUID
    name: str
    specs: Optional[Dict] = None

class AuditDetailResponse(BaseModel):
    id: UUID
    account_id: UUID
    template_id: Optional[UUID]
    security_score: int
    status: str
    deal_id: Optional[UUID]
    template_name: Optional[str]
    account_name: Optional[str] = None
    account_website: Optional[str] = None
    scan_mode: Optional[str] = None
    scan_status: Optional[str] = None
    scanned_asset_id: Optional[UUID] = None
    website_assets: List[WebsiteAssetBrief] = []
    responses: Optional[Dict[str, Dict[str, str]]]
    category_structure: Optional[List[Dict]]
    content: Optional[Dict] = None

    class Config:
        from_attributes = True

router = APIRouter(prefix="/sentinel", tags=["Sentinel"])

class DeepScanRequest(BaseModel):
    audit_id: UUID
    target_url: str

@router.get("/templates", response_model=List[TemplateListResponse])
def list_audit_templates(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    """
    Returns all active audit templates (Essential 8, NIST CSF, etc.)
    """
    templates = db.query(models.AuditTemplate).filter(
        models.AuditTemplate.is_active == True
    ).all()

    return templates

@router.post("/scan")
def queue_sentinel_scan(payload: DeepScanRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
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
def get_scan_status(audit_id: UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    audit = db.query(models.AuditReport).filter(models.AuditReport.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    return {
        "audit_id": audit_id,
        "scan_status": audit.scan_status,
        "last_scan_at": audit.last_scan_at
    }

@router.post("/audits/{audit_id}/scan")
def trigger_website_scan(
    audit_id: UUID,
    background_tasks: BackgroundTasks,
    payload: Optional[ScanRequest] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """
    Trigger an automated website health scan via Sanctum Audit API.
    Only valid for audits linked to a template with scan_mode == 'automated'.
    Optionally accepts asset_id to target a specific website asset.
    """
    audit = db.query(models.AuditReport).filter(
        models.AuditReport.id == audit_id
    ).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    # Validate template is automated
    template = db.query(models.AuditTemplate).filter(
        models.AuditTemplate.id == audit.template_id
    ).first()
    if not template or template.scan_mode != "automated":
        raise HTTPException(
            status_code=400,
            detail="This audit does not use an automated scan template"
        )

    # Look up account
    account = db.query(models.Account).filter(
        models.Account.id == audit.account_id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Resolve target URL: prefer asset_id, fall back to account.website
    scan_url = None
    scanned_asset_id = None

    if payload and payload.asset_id:
        asset = db.query(models.Asset).filter(
            models.Asset.id == payload.asset_id,
            models.Asset.asset_type == "website",
            models.Asset.account_id == audit.account_id,
        ).first()
        if not asset:
            raise HTTPException(
                status_code=400,
                detail="Website asset not found or does not belong to this account"
            )
        scan_url = asset.name
        scanned_asset_id = asset.id
    else:
        scan_url = account.website

    if not scan_url:
        raise HTTPException(
            status_code=400,
            detail="Account has no website URL configured"
        )

    # Set scan_status and target info
    audit.scan_status = "running"
    audit.target_url = scan_url
    audit.scanned_asset_id = scanned_asset_id
    db.commit()

    # Run scan in background
    background_tasks.add_task(
        _run_website_scan,
        audit_id=str(audit.id),
        url=scan_url,
        name=account.name or "",
        email=account.billing_email or "",
        business_name=account.name or "",
    )

    return {"status": "running", "message": "Scan initiated"}


def _run_website_scan(
    audit_id: str, url: str, name: str, email: str, business_name: str
):
    """Background task: trigger Sanctum Audit API, poll for result, update report."""
    from ..services.audit_client import (
        trigger_audit,
        poll_audit_until_complete,
        AuditAPIError,
    )

    db = database.SessionLocal()
    try:
        audit = db.query(models.AuditReport).filter(
            models.AuditReport.id == audit_id
        ).first()
        if not audit:
            logger.error("Audit %s not found in background task", audit_id)
            return

        # Step 1: trigger the audit
        trigger_result = trigger_audit(
            url=url, name=name, email=email, business_name=business_name
        )
        sanctum_audit_id = trigger_result["id"]
        logger.info(
            "Sanctum Audit triggered: %s for audit %s",
            sanctum_audit_id, audit_id,
        )

        # Step 2: poll until complete
        result = poll_audit_until_complete(str(sanctum_audit_id))

        # Step 3: write results
        # overall_score: int 0-100 from Audit API response (DOC-067)
        audit.security_score = result.get("overall_score", 0)
        audit.scan_status = "completed"
        audit.last_scan_at = datetime.utcnow()
        audit.content = {
            **(audit.content or {}),
            "sanctum_audit_id": str(sanctum_audit_id),
            "report_url": trigger_result.get("report_url", ""),
        }
        db.commit()
        logger.info("Audit %s scan completed, score=%s", audit_id, audit.security_score)

    except AuditAPIError as e:
        logger.error("Audit %s scan failed: %s", audit_id, e.message)
        audit = db.query(models.AuditReport).filter(
            models.AuditReport.id == audit_id
        ).first()
        if audit:
            audit.scan_status = "failed"
            audit.content = {
                **(audit.content or {}),
                "scan_error": str(e.message),
            }
            db.commit()
    except Exception as e:
        logger.exception("Unexpected error in scan task for audit %s", audit_id)
        audit = db.query(models.AuditReport).filter(
            models.AuditReport.id == audit_id
        ).first()
        if audit:
            audit.scan_status = "failed"
            audit.content = {
                **(audit.content or {}),
                "scan_error": str(e),
            }
            db.commit()
    finally:
        db.close()


@router.get("/audits/{audit_id}", response_model=AuditDetailResponse)
def get_audit_detail(audit_id: UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_active_user)):
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
    scan_mode = None
    responses = None

    if audit.template_id:
        template = db.query(models.AuditTemplate).filter(
            models.AuditTemplate.id == audit.template_id
        ).first()
        if template:
            template_name = template.name
            category_structure = template.category_structure
            scan_mode = template.scan_mode

    if submission:
        responses = submission.responses

    account = db.query(models.Account).filter(models.Account.id == audit.account_id).first()

    # Query website assets for this account
    website_assets = db.query(models.Asset).filter(
        models.Asset.account_id == audit.account_id,
        models.Asset.asset_type == "website",
    ).all()

    return {
        "id": audit.id,
        "account_id": audit.account_id,
        "account_name": account.name if account else None,
        "account_website": account.website if account else None,
        "template_id": audit.template_id,
        "security_score": audit.security_score,
        "status": audit.status,
        "deal_id": audit.deal_id,
        "template_name": template_name,
        "scan_mode": scan_mode,
        "scan_status": audit.scan_status,
        "scanned_asset_id": audit.scanned_asset_id,
        "website_assets": [
            {"id": a.id, "name": a.name, "specs": a.specs}
            for a in website_assets
        ],
        "category_structure": category_structure,
        "responses": responses,
        "content": audit.content,
    }

@router.get("/audits/{audit_id}/results")
async def get_audit_results(
    audit_id: UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Proxy to Sanctum Audit API — returns full scan results."""
    import asyncio
    from ..services.audit_client import fetch_audit_result, AuditAPIError

    audit = db.query(models.AuditReport).filter(
        models.AuditReport.id == audit_id
    ).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    content = audit.content or {}
    sanctum_audit_id = content.get("sanctum_audit_id")
    if not sanctum_audit_id:
        raise HTTPException(
            status_code=404,
            detail="No scan results available — scan has not completed"
        )

    try:
        result = await asyncio.to_thread(fetch_audit_result, sanctum_audit_id)
    except AuditAPIError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch results from Audit API: {e.message}"
        )

    return result


@router.post("/audits/{audit_id}/submit")
def submit_audit_responses(
    audit_id: UUID,
    payload: AuditSubmissionRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """
    Submits or updates audit responses and recalculates security score.
    """
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
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
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
