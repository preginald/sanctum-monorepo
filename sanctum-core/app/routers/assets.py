from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from .. import models, schemas, auth
from ..database import get_db
from datetime import datetime, timedelta, date

from ..services.billing_service import billing_service

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.get("", response_model=List[schemas.AssetResponse])
def get_assets(account_id: Optional[UUID] = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    query = db.query(models.Asset)
    if account_id:
        query = query.filter(models.Asset.account_id == account_id)
    
    # Scope Security
    if current_user.role == 'client':
        query = query.filter(models.Asset.account_id == current_user.account_id)
        
    return query.all()

@router.post("", response_model=schemas.AssetResponse)
def create_asset(asset: schemas.AssetCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    if current_user.role == 'client': raise HTTPException(status_code=403, detail="Forbidden")
    new_asset = models.Asset(**asset.model_dump())
    db.add(new_asset)
    db.commit()
    db.refresh(new_asset)

    # NEW: Trigger Billing Check
    if new_asset.auto_invoice and new_asset.linked_product_id:
        billing_service.check_and_invoice_asset(db, new_asset.id)

    return new_asset

@router.put("/{asset_id}", response_model=schemas.AssetResponse)
def update_asset(asset_id: UUID, update: schemas.AssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset: raise HTTPException(status_code=404, detail="Asset not found")
    
    # Capture state before update
    old_expires_at = asset.expires_at
    had_pending_renewal = asset.pending_renewal_invoice_id

    update_data = update.model_dump(exclude_unset=True)
    update_data.pop('send_renewal_notification', None)
    for key, value in update_data.items():
        setattr(asset, key, value)

    db.commit()
    db.refresh(asset)

    # NEW: Trigger Billing Check (in case they just turned on auto-invoice)
    if asset.auto_invoice and asset.linked_product_id:
        billing_service.check_and_invoice_asset(db, asset.id)

    # Phase 66: Renewal notification logic
    expiry_pushed_forward = (
        asset.expires_at and old_expires_at and asset.expires_at > old_expires_at
    )

    if expiry_pushed_forward:
        account = db.query(models.Account).filter(models.Account.id == asset.account_id).first()

        # Renewal flow — clear idempotency lock
        if had_pending_renewal:
            asset.pending_renewal_invoice_id = None
            db.commit()
            asset.renewal_cleared = True

        # Fire client notification if renewal flow OR manual flag set
        should_notify = had_pending_renewal or update.send_renewal_notification

        if should_notify and account and account.billing_email:
            html = f"""
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <h2 style='color: #1a1a2e;'>Service Renewed</h2>
                <p>Dear {account.name},</p>
                <p>Your service has been successfully renewed:</p>
                <table style='width:100%; border-collapse:collapse; margin: 16px 0;'>
                    <tr style='background:#f5f5f5;'>
                        <td style='padding:8px; border:1px solid #ddd;'><strong>Asset</strong></td>
                        <td style='padding:8px; border:1px solid #ddd;'>{asset.name}</td>
                    </tr>
                    <tr>
                        <td style='padding:8px; border:1px solid #ddd;'><strong>Type</strong></td>
                        <td style='padding:8px; border:1px solid #ddd;'>{asset.asset_type}</td>
                    </tr>
                    <tr style='background:#f5f5f5;'>
                        <td style='padding:8px; border:1px solid #ddd;'><strong>New Expiry</strong></td>
                        <td style='padding:8px; border:1px solid #ddd;'>{asset.expires_at.strftime('%d %b %Y')}</td>
                    </tr>
                </table>
                <p style='color:#666; font-size:12px;'>Digital Sanctum — Managed IT Services</p>
            </div>
            """
            from ..services.email_service import email_service as _email_service
            _email_service.send(
                to_emails=account.billing_email,
                subject=f"{asset.name} Has Been Renewed",
                html_content=html
            )

    return asset

@router.delete("/{asset_id}")
def delete_asset(asset_id: UUID, db: Session = Depends(get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset: raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(asset)
    db.commit()
    return {"status": "deleted"}

@router.get("/lifecycle/expiring")
def get_expiring_assets(
    days: int = 90,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Returns assets expiring within N days, and auto-updates status."""
    if current_user.role == 'client':
        raise HTTPException(status_code=403, detail="Admin only.")

    today = date.today()
    cutoff = today + timedelta(days=days)

    # Auto-update statuses
    # Expired: expires_at < today and status not already expired/decommissioned
    db.query(models.Asset).filter(
        models.Asset.expires_at < today,
        models.Asset.status.notin_(['expired', 'decommissioned'])
    ).update({"status": "expired"}, synchronize_session=False)

    # Expiring: expires_at between today and cutoff, status is active
    db.query(models.Asset).filter(
        models.Asset.expires_at >= today,
        models.Asset.expires_at <= cutoff,
        models.Asset.status == 'active'
    ).update({"status": "expiring"}, synchronize_session=False)

    db.commit()

    # Fetch all non-healthy assets
    assets = db.query(models.Asset).filter(
        models.Asset.expires_at != None,
        models.Asset.expires_at <= cutoff,
        models.Asset.status.in_(['expiring', 'expired'])
    ).order_by(models.Asset.expires_at.asc()).all()

    result = []
    for a in assets:
        days_until = (a.expires_at - today).days if a.expires_at else None
        result.append({
            "id": str(a.id),
            "account_id": str(a.account_id),
            "account_name": a.account.name if a.account else "Unknown",
            "name": a.name,
            "asset_type": a.asset_type,
            "status": a.status,
            "vendor": a.vendor,
            "expires_at": a.expires_at.isoformat() if a.expires_at else None,
            "days_until_expiry": days_until,
            "is_expired": days_until is not None and days_until < 0,
            "auto_invoice": a.auto_invoice,
            "linked_product_id": str(a.linked_product_id) if a.linked_product_id else None,
            "pending_renewal_invoice_id": str(a.pending_renewal_invoice_id) if a.pending_renewal_invoice_id else None
        })

    expired_count = sum(1 for r in result if r["is_expired"])
    expiring_count = len(result) - expired_count

    return {
        "total": len(result),
        "expired_count": expired_count,
        "expiring_count": expiring_count,
        "days_window": days,
        "assets": result
    }

@router.get("/{asset_id}")
def get_asset_detail(
    asset_id: UUID,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    from sqlalchemy.orm import joinedload

    asset = db.query(models.Asset).options(
        joinedload(models.Asset.account),
        joinedload(models.Asset.linked_product)
    ).filter(models.Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if current_user.role == 'client' and asset.account_id != current_user.account_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Get linked tickets
    linked_tickets = db.query(models.Ticket).join(
        models.ticket_assets
    ).filter(
        models.ticket_assets.c.asset_id == asset_id
    ).order_by(models.Ticket.created_at.desc()).all()

    today = date.today()
    days_until = (asset.expires_at - today).days if asset.expires_at else None

    return {
        "id": str(asset.id),
        "account_id": str(asset.account_id),
        "account_name": asset.account.name if asset.account else "Unknown",
        "name": asset.name,
        "asset_type": asset.asset_type,
        "status": asset.status,
        "serial_number": asset.serial_number,
        "ip_address": asset.ip_address,
        "notes": asset.notes,
        "vendor": asset.vendor,
        "expires_at": asset.expires_at.isoformat() if asset.expires_at else None,
        "days_until_expiry": days_until,
        "auto_invoice": asset.auto_invoice,
        "linked_product": asset.linked_product.name if asset.linked_product else None,
        "specs": asset.specs or {},
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "updated_at": asset.updated_at.isoformat() if asset.updated_at else None,
        "tickets": [
            {
                "id": t.id,
                "subject": t.subject,
                "status": t.status,
                "priority": t.priority,
                "created_at": t.created_at.isoformat() if t.created_at else None
            } for t in linked_tickets
        ]
    }

@router.post("/{asset_id}/renewal-ticket")
def create_renewal_ticket(
    asset_id: UUID,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Creates a renewal ticket for an expiring/expired asset."""
    if current_user.role == 'client':
        raise HTTPException(status_code=403, detail="Admin only.")

    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Check for existing open renewal ticket
    existing = db.query(models.Ticket).filter(
        models.Ticket.account_id == asset.account_id,
        models.Ticket.subject.ilike(f"%Renewal%{asset.name}%"),
        models.Ticket.status.notin_(['resolved', 'closed'])
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail=f"Open renewal ticket already exists: #{existing.id}")

    expiry_str = asset.expires_at.strftime("%d %b %Y") if asset.expires_at else "Unknown"
    vendor_str = f" ({asset.vendor})" if asset.vendor else ""

    ticket = models.Ticket(
        account_id=asset.account_id,
        subject=f"Renewal: {asset.name}{vendor_str}",
        description=f"**Asset Renewal Required**\n\n"
                     f"- **Asset:** {asset.name}\n"
                     f"- **Type:** {asset.asset_type}\n"
                     f"- **Vendor:** {asset.vendor or 'N/A'}\n"
                     f"- **Expiry Date:** {expiry_str}\n"
                     f"- **Serial/IP:** {asset.serial_number or asset.ip_address or 'N/A'}\n\n"
                     f"Please review and action renewal before expiry.",
        status='new',
        priority='high',
        ticket_type='task'
    )
    db.add(ticket)
    db.flush()

    # Link asset to ticket
    db.execute(models.ticket_assets.insert().values(ticket_id=ticket.id, asset_id=asset.id))

    db.commit()
    db.refresh(ticket)

    return {"status": "created", "ticket_id": ticket.id, "subject": ticket.subject}