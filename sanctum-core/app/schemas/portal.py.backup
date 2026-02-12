from typing import List, Optional, Dict, Any
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
    category_assessments: Dict[str, List[Dict[str, Any]]] = {}  # {"security": [{id, template_name, status, score}, ...]}
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
