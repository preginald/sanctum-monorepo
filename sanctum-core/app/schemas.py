from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date

# --- AUTH & USERS ---

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    access_scope: str
    is_active: bool
    account_id: Optional[UUID] = None

    class Config:
        from_attributes = True

class ClientUserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

# --- ANALYTICS ---

class DashboardStats(BaseModel):
    revenue_realized: float    
    pipeline_value: float      
    active_audits: int
    open_tickets: int
    critical_tickets: int      

# --- PRODUCT CATALOG ---

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str 
    unit_price: float

class ProductResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    type: str
    unit_price: float
    is_active: bool
    
    class Config:
        from_attributes = True

# --- CRM (ACCOUNTS & CONTACTS) ---

class AccountCreate(BaseModel):
    name: str
    type: str 
    brand_affinity: str 
    status: str = 'prospect'
    billing_email: Optional[str] = None

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    brand_affinity: Optional[str] = None
    billing_email: Optional[str] = None

class AccountResponse(BaseModel):
    id: UUID
    name: str
    type: str
    status: str
    brand_affinity: str
    billing_email: Optional[str] = None
    
    class Config:
        from_attributes = True

class ContactCreate(BaseModel):
    account_id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    persona: Optional[str] = None 
    reports_to_id: Optional[UUID] = None 

class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    persona: Optional[str] = None
    reports_to_id: Optional[UUID] = None

class ContactResponse(BaseModel):
    id: UUID
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary_contact: bool
    persona: str | None = None
    reports_to_id: Optional[UUID] = None 

    class Config:
        from_attributes = True

# --- CAMPAIGNS (MARKETING) ---

class CampaignTargetFilter(BaseModel):
    account_status: Optional[str] = None
    brand_affinity: Optional[str] = None

class CampaignTargetAddResult(BaseModel):
    added_count: int
    message: str

class CampaignTargetResponse(BaseModel):
    id: UUID
    contact_id: UUID
    contact_name: str
    contact_email: Optional[str] = None
    status: str
    sent_at: Optional[datetime] = None
    class Config: from_attributes = True

class CampaignCreate(BaseModel):
    name: str
    type: str = 'email'
    brand_affinity: str = 'ds'
    budget_cost: float = 0.0

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    budget_cost: Optional[float] = None

class CampaignResponse(BaseModel):
    id: UUID
    name: str
    type: str
    status: str
    brand_affinity: str
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    budget_cost: float
    created_at: datetime
    
    target_count: int = 0
    sent_count: int = 0
    deal_count: int = 0
    total_deal_value: float = 0.0
    
    class Config:
        from_attributes = True

# --- DEALS ---

class DealCreate(BaseModel):
    account_id: UUID
    title: str
    amount: float
    stage: str = "Infiltration"
    probability: int = 10
    expected_close_date: Optional[str] = None 

class DealUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    stage: Optional[str] = None
    probability: Optional[int] = None
    expected_close_date: Optional[str] = None

class DealResponse(BaseModel):
    id: UUID
    title: str
    amount: float
    stage: str
    probability: int
    account_id: UUID
    account_name: Optional[str] = None 
    source_campaign_id: Optional[UUID] = None
    campaign_name: Optional[str] = None      
    
    class Config:
        from_attributes = True

# --- INVOICING ---

class InvoiceLite(BaseModel):
    id: UUID
    status: str
    total_amount: float
    class Config:
        from_attributes = True

class InvoiceItemCreate(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float = 0.0

class InvoiceItemUpdate(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None

class InvoiceItemSchema(BaseModel):
    id: UUID
    description: str
    quantity: float
    unit_price: float
    total: float
    ticket_id: Optional[int] = None
    source_type: Optional[str] = None
    class Config: from_attributes = True

class InvoiceDeliveryLogResponse(BaseModel):
    id: UUID
    sent_at: datetime
    sent_to: str
    sent_cc: Optional[str]
    status: str
    sender_name: Optional[str] = None
    class Config: from_attributes = True

class InvoiceSendRequest(BaseModel):
    to_email: EmailStr
    cc_emails: List[EmailStr] = []
    subject: Optional[str] = None
    message: Optional[str] = None

class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    due_date: Optional[date] = None
    generated_at: Optional[datetime] = None
    payment_terms: Optional[str] = None

class InvoiceResponse(BaseModel):
    id: UUID
    account_id: UUID
    account_name: Optional[str] = None
    status: str
    subtotal_amount: float
    gst_amount: float
    total_amount: float
    payment_terms: str
    due_date: Optional[date] = None
    generated_at: datetime
    pdf_path: Optional[str] = None
    items: List[InvoiceItemSchema] = []
    delivery_logs: List[InvoiceDeliveryLogResponse] = []
    suggested_cc: List[str] = []

    class Config:
        from_attributes = True

# --- PROJECTS & MILESTONES ---

class MilestoneReorderItem(BaseModel):
    id: UUID
    sequence: int

class MilestoneReorderRequest(BaseModel):
    items: List[MilestoneReorderItem]

class MilestoneCreate(BaseModel):
    name: str
    due_date: Optional[date] = None
    status: str = 'pending'
    billable_amount: float = 0.0
    sequence: int = 1

class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    billable_amount: Optional[float] = None
    due_date: Optional[date] = None
    sequence: Optional[int] = None
    invoice_id: Optional[UUID] = None

class MilestoneResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    due_date: Optional[date] = None
    status: str
    billable_amount: float
    invoice_id: Optional[UUID] = None
    sequence: int = 1
    class Config: from_attributes = True

class ProjectCreate(BaseModel):
    account_id: UUID
    deal_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    budget: float = 0.0

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[float] = None
    due_date: Optional[date] = None

class ProjectResponse(BaseModel):
    id: UUID
    account_id: UUID
    account_name: Optional[str] = None
    name: str
    status: str
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    budget: float
    milestones: List[MilestoneResponse] = []
    class Config: from_attributes = True

# --- TICKETS & OPS ---

class TimeEntryCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    description: Optional[str] = None
    product_id: Optional[UUID] = None

class TimeEntryUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    description: Optional[str] = None
    product_id: Optional[UUID] = None

class TimeEntryResponse(BaseModel):
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
    calculated_value: float = 0.0
    created_at: datetime
    class Config: from_attributes = True

class TicketMaterialCreate(BaseModel):
    product_id: UUID
    quantity: int = 1

class TicketMaterialUpdate(BaseModel):
    product_id: Optional[UUID] = None
    quantity: Optional[int] = None

class TicketMaterialResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    quantity: int
    unit_price: float = 0.0
    class Config: from_attributes = True

class TicketCreate(BaseModel):
    account_id: UUID
    contact_ids: List[UUID] = [] 
    subject: str
    description: Optional[str] = None 
    priority: str = 'normal'
    assigned_tech_id: Optional[UUID] = None
    ticket_type: str = 'support'
    milestone_id: Optional[UUID] = None

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    resolution: Optional[str] = None
    assigned_tech_id: Optional[UUID] = None
    contact_ids: Optional[List[UUID]] = None
    created_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    ticket_type: Optional[str] = None
    milestone_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None # Unified Contact Field? No, using M2M list usually.

class TicketResponse(BaseModel):
    id: int
    subject: str
    description: Optional[str] = None
    status: str
    priority: str
    resolution: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None  
    closed_at: Optional[datetime] = None
    account_id: UUID
    contact_ids: List[UUID] = [] 
    account_name: Optional[str] = None
    contact_name: Optional[str] = None
    
    ticket_type: str = 'support'
    milestone_id: Optional[UUID] = None
    milestone_name: Optional[str] = None
    project_id: Optional[UUID] = None
    project_name: Optional[str] = None
    
    related_invoices: List[InvoiceLite] = [] 

    contacts: List[ContactResponse] = [] 
    time_entries: List[TimeEntryResponse] = []
    materials: List[TicketMaterialResponse] = [] 
    total_hours: float = 0.0

    class Config:
        from_attributes = True

class LeadSchema(BaseModel):
    name: str
    email: EmailStr
    company: str
    size: str
    challenge: str
    message: str

# --- AUDITS ---
class AuditItem(BaseModel):
    category: str 
    item: str     
    status: str   
    comment: str

class AuditCreate(BaseModel):
    account_id: UUID
    deal_id: Optional[UUID] = None
    items: List[AuditItem] = []

class AuditUpdate(BaseModel):
    items: List[AuditItem] 

class AuditResponse(BaseModel):
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
    class Config: from_attributes = True

# --- COMMENTS ---
class CommentCreate(BaseModel):
    body: str
    visibility: str = 'internal'
    ticket_id: Optional[int] = None
    deal_id: Optional[UUID] = None
    audit_id: Optional[UUID] = None

class CommentResponse(BaseModel):
    id: UUID
    author_name: str
    body: str
    visibility: str
    created_at: datetime
    class Config: from_attributes = True

# --- PORTAL ---
class PortalDashboard(BaseModel):
    account: AccountResponse
    security_score: int
    open_tickets: List[TicketResponse]
    invoices: List[InvoiceResponse]
    projects: List[ProjectResponse]

# --- MASTER ACCOUNT VIEW ---
class AccountDetail(AccountResponse):
    contacts: list[ContactResponse] = []
    deals: list[DealResponse] = []
    tickets: list[TicketResponse] = []
    projects: list[ProjectResponse] = []
    audit_data: dict | None = None 
    invoices: list[InvoiceResponse] = [] 

    class Config:
        from_attributes = True

# --- KNOWLEDGE BASE ---
class ArticleCreate(BaseModel):
    title: str
    slug: str
    content: str
    category: str = 'wiki'
    identifier: Optional[str] = None
    version: str = 'v1.0'

class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    identifier: Optional[str] = None
    version: Optional[str] = None

class ArticleResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    content: str
    category: str
    identifier: Optional[str] = None
    version: str
    author_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True