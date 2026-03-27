from typing import List, Optional
from uuid import UUID
from .shared import SanctumBase
from .artefacts import ArtefactLite

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
    ingest_token: Optional[UUID] = None  # Add this here
    artefacts: List[ArtefactLite] = []

    class Config:
        from_attributes = True

class ContactCreate(SanctumBase):
    account_id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    persona: Optional[str] = None
    reports_to_id: Optional[UUID] = None

    # The Convergence Flag
    enable_portal_access: bool = False

class ContactUpdate(SanctumBase):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    persona: Optional[str] = None
    reports_to_id: Optional[UUID] = None
    enable_portal_access: Optional[bool] = None

class ContactResponse(SanctumBase):
    id: UUID
    account_id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    persona: Optional[str] = None
    reports_to_id: Optional[UUID] = None
    is_primary_contact: bool = False
    portal_access: bool = False
    provisioning_result: Optional[dict] = None

    class Config:
        from_attributes = True
