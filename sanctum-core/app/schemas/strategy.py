from enum import Enum
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from pydantic import model_validator, Field
from .shared import SanctumBase
from .operations import TicketRelationResponse
from .artefacts import ArtefactLite

# --- CAMPAIGNS ---
class CampaignTargetFilter(SanctumBase):
    account_status: Optional[str] = None
    brand_affinity: Optional[str] = None

class CampaignTargetAddResult(SanctumBase):
    added_count: int
    message: str

class CampaignTargetResponse(SanctumBase):
    id: UUID
    contact_id: UUID
    contact_name: str
    contact_email: Optional[str] = None
    status: str
    sent_at: Optional[datetime] = None

class CampaignCreate(SanctumBase):
    name: str
    type: str = 'email'
    brand_affinity: str = 'ds'
    budget_cost: Decimal = Decimal("0.00")

class CampaignUpdate(SanctumBase):
    name: Optional[str] = None
    status: Optional[str] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    budget_cost: Optional[Decimal] = None

class CampaignResponse(CampaignCreate):
    id: UUID
    status: str
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    created_at: Optional[datetime] = None
    target_count: int = 0
    sent_count: int = 0
    deal_count: int = 0
    total_deal_value: Decimal = Decimal("0.00")

# --- DEALS ---
class DealCreate(SanctumBase):
    account_id: UUID
    title: str
    amount: Decimal
    stage: str = "Infiltration"
    probability: int = 10
    expected_close_date: Optional[str] = None

class DealUpdate(SanctumBase):
    title: Optional[str] = None
    amount: Optional[Decimal] = None
    stage: Optional[str] = None
    probability: Optional[int] = None
    expected_close_date: Optional[str] = None

class DealItemResponse(SanctumBase):
    id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    quantity: int
    override_price: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    total: Optional[Decimal] = None

class DealResponse(DealCreate):
    id: UUID
    account_name: Optional[str] = None
    source_campaign_id: Optional[UUID] = None
    campaign_name: Optional[str] = None
    items: List[DealItemResponse] = []

# --- PROJECTS & MILESTONES ---
class MilestoneReorderItem(SanctumBase):
    id: UUID
    sequence: int

class MilestoneStatusEnum(str, Enum):
    pending = "pending"
    active = "active"
    completed = "completed"

class MilestoneReorderRequest(SanctumBase):
    items: List[MilestoneReorderItem]

class MilestoneCreate(SanctumBase):
    name: str
    due_date: Optional[date] = None
    status: str = "pending"
    billable_amount: Decimal = Decimal("0.00")
    sequence: int = Field(default=1, ge=0)
    description: Optional[str] = None
    start_date: Optional[date] = None

class MilestoneUpdate(SanctumBase):
    name: Optional[str] = None
    status: Optional[str] = None
    billable_amount: Optional[Decimal] = None
    due_date: Optional[date] = None
    sequence: Optional[int] = Field(default=None, ge=0)
    invoice_id: Optional[UUID] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    skip_validation: bool = Field(default=False, exclude=True)

class TicketBrief(SanctumBase):
    id: int
    subject: str
    status: str
    priority: str
    ticket_type: str
    milestone_id: Optional[UUID] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    has_articles: bool = False
    related_tickets: List[TicketRelationResponse] = []
    total_hours: float = 0.0
    total_cost: Decimal = Decimal("0.00")
    unpriced_entries: int = 0

    @model_validator(mode="before")
    @classmethod
    def sanitise_related(cls, data):
        # When Pydantic reads from ORM, related_tickets may contain raw Ticket objects
        # instead of TicketRelationResponse dicts — replace with empty list
        if hasattr(data, "__dict__"):
            # ORM object — check if related_tickets contains non-dict items
            rt = getattr(data, "related_tickets", [])
            if rt and not isinstance(rt[0], (dict, TicketRelationResponse)):
                data.__dict__["related_tickets"] = []
        elif isinstance(data, dict):
            rt = data.get("related_tickets", [])
            if rt and not isinstance(rt[0], (dict, TicketRelationResponse)):
                data["related_tickets"] = []
        return data

class MilestoneResponse(MilestoneCreate):
    id: UUID
    project_id: UUID
    invoice_id: Optional[UUID] = None
    project_name: Optional[str] = None
    account_id: Optional[UUID] = None
    account_name: Optional[str] = None
    tickets: List[TicketBrief] = []
    artefacts: List[ArtefactLite] = []
    # Expand contract count fields (SYS-032)
    ticket_count: Optional[int] = None
    available_transitions: List[str] = []
    created_at: Optional[datetime] = None

class ProjectCreate(SanctumBase):
    account_id: UUID
    deal_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    budget: Decimal = Decimal("0.00")
    market_value: Optional[Decimal] = None
    quoted_price: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    discount_reason: Optional[str] = None
    pricing_model: Optional[str] = None
    status: Optional[str] = None
    template_id: Optional[UUID] = None

class ProjectUpdate(SanctumBase):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    status: Optional[str] = None
    budget: Optional[Decimal] = None
    due_date: Optional[date] = None
    market_value: Optional[Decimal] = None
    quoted_price: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    discount_reason: Optional[str] = None
    pricing_model: Optional[str] = None
    template_id: Optional[UUID] = None
    skip_validation: bool = Field(default=False, exclude=True)

class ProjectResponse(ProjectCreate):
    id: UUID
    account_name: Optional[str] = None
    status: str
    template_name: Optional[str] = None
    milestones: List[MilestoneResponse] = []
    artefacts: List[ArtefactLite] = []
    # Expand contract count fields (SYS-032)
    milestone_count: Optional[int] = None
    artefact_count: Optional[int] = None
    available_transitions: List[str] = []
    created_at: Optional[datetime] = None

VALID_RATE_TIERS = {"project_delivery", "reactive", "consulting", "internal"}

# --- RATE CARDS ---
class RateCardCreate(SanctumBase):
    account_id: Optional[UUID] = None
    tier: str

    @model_validator(mode="after")
    def validate_tier(self):
        if self.tier not in VALID_RATE_TIERS:
            raise ValueError(f"tier must be one of: {', '.join(sorted(VALID_RATE_TIERS))}")
        return self
    hourly_rate: Decimal
    effective_from: date

class RateCardUpdate(SanctumBase):
    hourly_rate: Optional[Decimal] = None
    effective_from: Optional[date] = None

class RateCardResponse(SanctumBase):
    id: UUID
    account_id: Optional[UUID] = None
    tier: str
    hourly_rate: Decimal
    effective_from: date
    account_name: Optional[str] = None

# --- AUDITS ---
class AuditItem(SanctumBase):
    category: str
    item: str
    status: str
    comment: str

class AuditCreate(SanctumBase):
    account_id: UUID
    deal_id: Optional[UUID] = None
    template_id: Optional[UUID] = None
    items: List[AuditItem] = []

class AuditUpdate(SanctumBase):
    items: List[AuditItem]

class AuditResponse(SanctumBase):
    id: UUID
    account_id: UUID
    template_id: Optional[UUID] = None
    template_name: Optional[str] = None
    scan_status: Optional[str] = None
    target_url: Optional[str] = None
    security_score: Optional[int] = 0
    infrastructure_score: Optional[int] = 0
    status: str
    report_pdf_path: Optional[str]
    content: dict
    updated_at: Optional[datetime] = None
    finalized_at: Optional[datetime] = None
