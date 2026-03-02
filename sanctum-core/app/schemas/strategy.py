from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from .shared import SanctumBase

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
    created_at: datetime
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

class MilestoneReorderRequest(SanctumBase):
    items: List[MilestoneReorderItem]

class MilestoneCreate(SanctumBase):
    name: str
    due_date: Optional[date] = None
    status: str = 'pending'
    billable_amount: Decimal = Decimal("0.00")
    sequence: int = 1
    description: Optional[str] = None

class MilestoneUpdate(SanctumBase):
    name: Optional[str] = None
    status: Optional[str] = None
    billable_amount: Optional[Decimal] = None
    due_date: Optional[date] = None
    sequence: Optional[int] = None
    invoice_id: Optional[UUID] = None
    description: Optional[str] = None

class MilestoneResponse(MilestoneCreate):
    id: UUID
    project_id: UUID
    invoice_id: Optional[UUID] = None

class ProjectCreate(SanctumBase):
    account_id: UUID
    deal_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    budget: Decimal = Decimal("0.00")

class ProjectUpdate(SanctumBase):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[Decimal] = None
    due_date: Optional[date] = None

class ProjectResponse(ProjectCreate):
    id: UUID
    account_name: Optional[str] = None
    status: str
    milestones: List[MilestoneResponse] = []

# --- AUDITS ---
class AuditItem(SanctumBase):
    category: str 
    item: str     
    status: str   
    comment: str

class AuditCreate(SanctumBase):
    account_id: UUID
    deal_id: Optional[UUID] = None
    items: List[AuditItem] = []

class AuditUpdate(SanctumBase):
    items: List[AuditItem] 

class AuditResponse(SanctumBase):
    id: UUID
    account_id: UUID
    security_score: Optional[int] = 0
    infrastructure_score: Optional[int] = 0
    status: str
    report_pdf_path: Optional[str]
    content: dict
    created_at: datetime
    updated_at: Optional[datetime] = None
    finalized_at: Optional[datetime] = None