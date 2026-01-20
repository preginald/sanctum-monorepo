from typing import Optional
from uuid import UUID
from datetime import datetime
from .shared import SanctumBase

class AssetCreate(SanctumBase):
    account_id: UUID
    name: str
    asset_type: str
    status: str = 'active'
    serial_number: Optional[str] = None
    ip_address: Optional[str] = None
    notes: Optional[str] = None

class AssetUpdate(SanctumBase):
    name: Optional[str] = None
    asset_type: Optional[str] = None
    status: Optional[str] = None
    serial_number: Optional[str] = None
    ip_address: Optional[str] = None
    notes: Optional[str] = None

class AssetResponse(AssetCreate):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None