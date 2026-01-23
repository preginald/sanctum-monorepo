from typing import Optional
from uuid import UUID
from datetime import datetime
from .shared import SanctumBase

class NotificationResponse(SanctumBase):
    id: UUID
    user_id: UUID
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

class NotificationUpdate(SanctumBase):
    is_read: bool