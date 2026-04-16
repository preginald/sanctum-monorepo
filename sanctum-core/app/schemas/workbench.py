from typing import Optional, List
from uuid import UUID
from datetime import datetime
from .shared import SanctumBase


class TicketSummary(SanctumBase):
    total: int = 0
    open: int = 0
    resolved: int = 0


class WorkbenchPinCreate(SanctumBase):
    project_id: UUID
    position: Optional[int] = 0


class WorkbenchPinResponse(SanctumBase):
    id: UUID
    user_id: UUID
    project_id: UUID
    project_name: Optional[str] = None
    project_status: Optional[str] = None
    account_name: Optional[str] = None
    position: int
    pinned_at: datetime
    ticket_summary: Optional[TicketSummary] = None


class WorkbenchListResponse(SanctumBase):
    pins: List[WorkbenchPinResponse] = []
    max_pins: int = 5


class WorkbenchReorderItem(SanctumBase):
    project_id: UUID
    position: int


class WorkbenchReorderRequest(SanctumBase):
    pin_order: List[WorkbenchReorderItem]


# --- Workbench Summary (rich card data) ---

class SummaryMilestone(SanctumBase):
    id: UUID
    name: str
    status: str


class SummaryTicket(SanctumBase):
    id: int
    subject: str
    status: str


class SummaryProgress(SanctumBase):
    resolved: int
    total: int


class SummaryHealth(SanctumBase):
    colour: str
    tooltip: str


class WorkbenchSummaryResponse(SanctumBase):
    project_id: UUID
    project_name: str
    status: str
    account_name: Optional[str] = None
    active_milestone: Optional[SummaryMilestone] = None
    current_ticket: Optional[SummaryTicket] = None
    next_ticket: Optional[SummaryTicket] = None
    progress: SummaryProgress
    health: SummaryHealth
    last_activity_at: Optional[datetime] = None
