from typing import Optional
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
    
    # NEW: Digital Lifecycle Fields (Must be present to save)
    expires_at: Optional[date] = None
    vendor: Optional[str] = None
    linked_product_id: Optional[UUID] = None
    auto_invoice: bool = False

class AssetUpdate(SanctumBase):
    name: Optional[str] = None
    asset_type: Optional[str] = None
    status: Optional[str] = None
    serial_number: Optional[str] = None
    ip_address: Optional[str] = None
    notes: Optional[str] = None
    
    # NEW: Digital Lifecycle Fields (Must be present to update)
    expires_at: Optional[date] = None
    vendor: Optional[str] = None
    linked_product_id: Optional[UUID] = None
    auto_invoice: Optional[bool] = None

class AssetResponse(AssetCreate):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None