from enum import Enum
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import Field
from .crm import ContactResponse
from .artefacts import ArtefactLite
from .shared import SanctumBase, InvoiceLite, ArticleLite, AssetLite


class TicketTypeEnum(str, Enum):
    support = "support"
    bug = "bug"
    feature = "feature"
    refactor = "refactor"
    task = "task"
    access = "access"
    maintenance = "maintenance"
    alert = "alert"
    hotfix = "hotfix"
    test = "test"


class PriorityEnum(str, Enum):
    low = "low"
    normal = "normal"
    high = "high"
    critical = "critical"

class TimeEntryCreate(SanctumBase):
    start_time: datetime
    end_time: datetime
    description: Optional[str] = None
    product_id: Optional[UUID] = None

class TimeEntryUpdate(SanctumBase):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    description: Optional[str] = None
    product_id: Optional[UUID] = None

class TimeEntryResponse(SanctumBase):
    id: UUID
    ticket_id: int
    user_id: UUID
    user_name: Optional[str] = None
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    description: Optional[str] = None
    product_id: Optional[UUID] = None
    service_name: Optional[str] = None
    calculated_value: Decimal = Decimal("0.00")
    created_at: datetime

    # Financial Link
    invoice_id: Optional[UUID] = None
    invoice_status: Optional[str] = None # NEW

class TicketMaterialCreate(SanctumBase):
    product_id: UUID
    quantity: int = 1

class TicketMaterialUpdate(SanctumBase):
    product_id: Optional[UUID] = None
    quantity: Optional[int] = None

class TicketMaterialResponse(SanctumBase):
    id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    quantity: int
    unit_price: Decimal = Decimal("0.00")
    calculated_value: Decimal = Decimal("0.00")

    # Financial Link
    invoice_id: Optional[UUID] = None
    invoice_status: Optional[str] = None # NEW

class TicketCreate(SanctumBase):
    account_id: UUID
    contact_ids: List[UUID] = []
    subject: str
    description: Optional[str] = None
    priority: PriorityEnum = PriorityEnum.normal
    assigned_tech_id: Optional[UUID] = None
    ticket_type: TicketTypeEnum = TicketTypeEnum.support
    milestone_id: Optional[UUID] = None
    skip_validation: bool = Field(default=False, exclude=True)

class TicketUpdate(SanctumBase):
    status: Optional[str] = None
    priority: Optional[PriorityEnum] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    resolution: Optional[str] = None
    assigned_tech_id: Optional[UUID] = None
    contact_ids: Optional[List[UUID]] = None
    created_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    ticket_type: Optional[TicketTypeEnum] = None
    milestone_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    resolution_comment_id: Optional[UUID] = None
    skip_validation: bool = Field(default=False, exclude=True)

class TicketRelationResponse(SanctumBase):
    id: int
    subject: str
    status: str
    priority: str
    ticket_type: str
    relation_type: str
    visibility: str

class TicketResponse(TicketCreate):
    resolved_description: Optional[str] = None
    id: int
    status: str
    resolution: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    account_name: Optional[str] = None
    contact_name: Optional[str] = None

    milestone_name: Optional[str] = None
    project_id: Optional[UUID] = None
    project_name: Optional[str] = None

    related_invoices: List[InvoiceLite] = []
    contacts: List[ContactResponse] = []
    time_entries: List[TimeEntryResponse] = []
    materials: List[TicketMaterialResponse] = []
    articles: List[ArticleLite] = []
    assets: List[AssetLite] = []
    artefacts: List[ArtefactLite] = []
    related_tickets: List[TicketRelationResponse] = []

    total_hours: float = 0.0
    resolution_comment_id: Optional[UUID] = None

class LeadSchema(SanctumBase):
    name: str
    email: str
    company: str
    size: str
    challenge: str
    message: str
