from typing import Optional
from uuid import UUID
from datetime import datetime
from .shared import SanctumBase

# --- PREFERENCES ---
class PreferenceUpdate(SanctumBase):
    email_frequency: str # 'realtime', 'hourly', 'daily'
    force_critical: bool

class PreferenceResponse(SanctumBase):
    email_frequency: str
    force_critical: bool

# --- NOTIFICATIONS ---
class NotificationResponse(SanctumBase):
    id: UUID
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime
    
    # New Fields
    status: str
    priority: str
    event_type: Optional[str] = None

class NotificationUpdate(SanctumBase):
    is_read: bool