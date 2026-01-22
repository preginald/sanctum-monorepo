from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from .shared import SanctumBase

class AutomationCreate(SanctumBase):
    name: str
    description: Optional[str] = None
    event_type: str
    action_type: str
    config: Dict[str, Any] = {}
    is_active: bool = True

class AutomationUpdate(SanctumBase):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class AutomationResponse(AutomationCreate):
    id: UUID
    created_at: datetime

class AutomationLogResponse(SanctumBase):
    id: UUID
    automation_id: UUID
    triggered_at: datetime
    status: str
    output: Optional[str] = None
