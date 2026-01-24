from typing import Optional
from uuid import UUID
from .shared import SanctumBase

class AccountCreate(SanctumBase):
    name: str
    type: str 
    brand_affinity: str 
    status: str = 'prospect'
    billing_email: Optional[str] = None

class AccountUpdate(SanctumBase):
    name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    brand_affinity: Optional[str] = None
    billing_email: Optional[str] = None

class AccountResponse(AccountCreate):
    id: UUID

class ContactCreate(SanctumBase):
    account_id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    persona: Optional[str] = None 
    reports_to_id: Optional[UUID] = None 

class ContactUpdate(SanctumBase):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    persona: Optional[str] = None
    reports_to_id: Optional[UUID] = None

class ContactResponse(ContactCreate):
    id: UUID
    is_primary_contact: bool
    # Overwrite account_id to be optional in response if needed, but it's usually present

class ContactCreate(SanctumBase):
    account_id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    persona: Optional[str] = None 
    reports_to_id: Optional[UUID] = None 
    
    # NEW: The Convergence Flag
    enable_portal_access: bool = False
