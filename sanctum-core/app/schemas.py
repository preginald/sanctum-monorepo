from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime

# 1. Login Request
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# 2. User Output (What we send back to the frontend)
# We NEVER send the password_hash back.
class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    access_scope: str
    is_active: bool

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    revenue_mtd: float
    active_audits: int
    open_tickets: int

class AccountCreate(BaseModel):
    name: str
    type: str # 'business' or 'residential'
    brand_affinity: str # 'ds', 'nt', 'both'
    status: str = 'prospect'

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    brand_affinity: Optional[str] = None

# --- AUDIT SCHEMAS ---

class AuditItem(BaseModel):
    category: str # e.g. "Network Security"
    item: str     # e.g. "Firewall Config"
    status: str   # "red", "amber", "green"
    comment: str

class AuditCreate(BaseModel):
    account_id: UUID
    deal_id: Optional[UUID] = None
    items: List[AuditItem] = []

class AuditUpdate(BaseModel):
    items: List[AuditItem] # Reuse the item schema

class AuditResponse(BaseModel):
    id: UUID
    account_id: UUID
    # Change int to Optional[int] = 0 (or None)
    security_score: Optional[int] = 0
    infrastructure_score: Optional[int] = 0
    status: str
    report_pdf_path: Optional[str]
    content: dict
    # UPDATE TIMESTAMPS
    created_at: datetime
    updated_at: Optional[datetime] = None
    finalized_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AccountResponse(BaseModel):
    id: UUID
    name: str
    type: str
    status: str
    brand_affinity: str
    
    class Config:
        from_attributes = True

# --- NESTED DETAIL SCHEMAS ---

class ContactCreate(BaseModel):
    account_id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    persona: Optional[str] = None # New
    reports_to_id: Optional[UUID] = None # New

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
    reports_to_id: Optional[UUID] = None # <--- THIS WAS MISSING

    class Config:
        from_attributes = True

class DealCreate(BaseModel):
    account_id: UUID
    title: str
    amount: float
    stage: str = "Infiltration"
    probability: int = 10
    expected_close_date: Optional[str] = None # ISO Date string

class DealUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    stage: Optional[str] = None
    probability: Optional[int] = None
    expected_close_date: Optional[str] = None

# --- UPDATE DEAL RESPONSE (Add Client Name) ---
class DealResponse(BaseModel):
    id: UUID
    title: str
    amount: float
    stage: str
    probability: int
    account_id: UUID
    account_name: Optional[str] = None # <--- New for Kanban
    
    class Config:
        from_attributes = True

class TicketCreate(BaseModel):
    account_id: UUID
    contact_ids: List[UUID] = [] # New list input
    subject: str
    description: Optional[str] = None # New
    priority: str = 'normal'
    assigned_tech_id: Optional[UUID] = None

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    resolution: Optional[str] = None
    assigned_tech_id: Optional[UUID] = None
    contact_ids: Optional[List[UUID]] = None

class TicketResponse(BaseModel):
    id: int
    subject: str
    description: Optional[str] = None
    status: str
    priority: str
    resolution: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None  # <--- Added
    closed_at: Optional[datetime] = None
    account_id: UUID
    contact_ids: List[UUID] = [] # New list input
    account_name: Optional[str] = None
    contact_name: Optional[str] = None

    # NEW FIELD: Allow the list of objects through
    contacts: List[ContactResponse] = [] 
    
    class Config:
        from_attributes = True

# The Master View
class AccountDetail(AccountResponse):
    contacts: list[ContactResponse] = []
    deals: list[DealResponse] = []
    tickets: list[TicketResponse] = []
    audit_data: dict | None = None # To see the website form data

    class Config:
        from_attributes = True

# --- COMMENT SCHEMAS ---
class CommentCreate(BaseModel):
    body: str
    visibility: str = 'internal'
    # Polymorphic input: Only one should be sent
    ticket_id: Optional[int] = None
    deal_id: Optional[UUID] = None
    audit_id: Optional[UUID] = None

class CommentResponse(BaseModel):
    id: UUID
    author_name: str
    body: str
    visibility: str
    created_at: datetime
    
    class Config:
        from_attributes = True