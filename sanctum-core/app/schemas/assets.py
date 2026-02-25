from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date
from .shared import SanctumBase

class AssetCreate(SanctumBase):
    account_id: UUID
    name: str
    asset_type: str
    status: str = 'active'
    serial_number: Optional[str] = None
    ip_address: Optional[str] = None
    notes: Optional[str] = None
    
    # Digital Lifecycle Fields
    expires_at: Optional[date] = None
    vendor: Optional[str] = None
    linked_product_id: Optional[UUID] = None
    auto_invoice: bool = False

    # NEW: Asset Intelligence
    specs: Optional[Dict[str, Any]] = {}

class AssetUpdate(SanctumBase):
    name: Optional[str] = None
    asset_type: Optional[str] = None
    status: Optional[str] = None
    serial_number: Optional[str] = None
    ip_address: Optional[str] = None
    notes: Optional[str] = None
    
    expires_at: Optional[date] = None
    vendor: Optional[str] = None
    linked_product_id: Optional[UUID] = None
    auto_invoice: Optional[bool] = None
    pending_renewal_invoice_id: Optional[UUID] = None

    # NEW: Asset Intelligence
    specs: Optional[Dict[str, Any]] = None

class AssetResponse(AssetCreate):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    pending_renewal_invoice_id: Optional[UUID] = None