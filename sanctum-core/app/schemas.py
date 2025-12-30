from pydantic import BaseModel, EmailStr
from typing import Optional
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

class ContactResponse(BaseModel):
    id: UUID
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary_contact: bool
    persona: str | None = None  # <--- Added
    # We won't nest reports_to_id here to avoid recursion hell for now

    class Config:
        from_attributes = True

class DealResponse(BaseModel):
    id: UUID
    title: str
    amount: float
    
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
