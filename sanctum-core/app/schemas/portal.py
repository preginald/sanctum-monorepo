from typing import List, Optional, Dict
from .shared import SanctumBase
from .crm import AccountResponse, ContactResponse
from .operations import TicketResponse
from .billing import InvoiceResponse
from .strategy import ProjectResponse, DealResponse
from .assets import AssetResponse 

class PortalDashboard(SanctumBase):
    account: AccountResponse
    security_score: int
    audit_id: Optional[str] = None
    category_scores: Dict[str, int] = {}
    category_audit_ids: Dict[str, str] = {}
    category_statuses: Dict[str, str] = {}  # NEW: {"security": "finalized", "infrastructure": "draft", ...}
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
