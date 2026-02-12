from typing import List, Optional, Dict, Any
from .shared import SanctumBase
from .crm import AccountResponse, ContactResponse
from .operations import TicketResponse
from .billing import InvoiceResponse
from .strategy import ProjectResponse, DealResponse
from .assets import AssetResponse 

# PHASE 61A: Questionnaire Schemas
from typing import List, Optional, Dict, Any
from uuid import UUID
from .shared import SanctumBase
from .crm import AccountResponse, ContactResponse
from .operations import TicketResponse
from .billing import InvoiceResponse
from .strategy import ProjectResponse, DealResponse
from .assets import AssetResponse 

# PHASE 62: Vendor Catalog Integration
class QuestionnaireSubmit(SanctumBase):
    """Client submission of Pre-Engagement Questionnaire with vendor catalog"""
    # Section 1: Technology (creates assets)
    company_size: str
    assessment_interest: str
    domain_names: Optional[str] = None  # Tag input (newline-separated)
    hosting_providers: Optional[List[UUID]] = None  # PHASE 62: Array of vendor IDs
    saas_platforms: Optional[List[UUID]] = None  # PHASE 62: Array of vendor IDs
    
    # Security questions (conditional)
    antivirus: Optional[List[UUID]] = None  # PHASE 62: Array of vendor IDs (usually 1)
    firewall_type: Optional[str] = None  # Free text selection
    password_management: Optional[str] = None  # Free text selection
    mfa_enabled: Optional[str] = None  # Free text selection
    backup_solution: Optional[str] = None  # Free text selection
    
    # Section 2: Context (helps us serve better)
    primary_pain_point: str
    current_it_support: Optional[str] = None
    timeline: str
    referral_source: str

# Portal Dashboard (Updated for Phase 61A)
class PortalDashboard(SanctumBase):
    account: AccountResponse
    security_score: int
    audit_id: Optional[str] = None
    category_assessments: Dict[str, List[Dict[str, Any]]] = {}
    needs_questionnaire: bool = False  # Phase 61A
    lifecycle_stage: str = 'active'  # Phase 61A: 'prospect', 'onboarding', 'active'
    open_tickets: List[TicketResponse]
    invoices: List[InvoiceResponse]
    projects: List[ProjectResponse]

# Master Account View (Internal)
class AccountDetail(AccountResponse):
    contacts: List[ContactResponse] = []
    deals: List[DealResponse] = []
    tickets: List[TicketResponse] = []
    projects: List[ProjectResponse] = []
    audit_data: Optional[Dict] = None 
    invoices: List[InvoiceResponse] = []
    assets: List[AssetResponse] = []
