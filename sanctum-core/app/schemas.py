from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID

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

class AuditResponse(BaseModel):
    id: UUID
    account_id: UUID
    security_score: int
    infrastructure_score: int
    status: str
    report_pdf_path: Optional[str]
    content: dict # The JSON payload
    created_at: Optional[str] = None # Simplified for now

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

class DealResponse(BaseModel):
    id: UUID
    title: str
    amount: float
    stage: str
    probability: int
    account_id: UUID # Useful for the frontend
    
    class Config:
        from_attributes = True

class TicketResponse(BaseModel):
    id: int
    subject: str
    status: str
    priority: str
    
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
