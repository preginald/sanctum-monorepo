from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from .. import models, schemas, auth
from ..database import get_db

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
    
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)
    
    db.commit()
    db.refresh(asset)

    # NEW: Trigger Billing Check (in case they just turned on auto-invoice)
    if asset.auto_invoice and asset.linked_product_id:
        billing_service.check_and_invoice_asset(db, asset.id)

    return asset

@router.delete("/{asset_id}")
def delete_asset(asset_id: UUID, db: Session = Depends(get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset: raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(asset)
    db.commit()
    return {"status": "deleted"}