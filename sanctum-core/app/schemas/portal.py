from typing import List, Optional, Dict
from .shared import SanctumBase
from .crm import AccountResponse, ContactResponse
from .operations import TicketResponse
from .billing import InvoiceResponse
from .strategy import ProjectResponse, DealResponse
# NEW: Import AssetResponse
from .assets import AssetResponse 

class PortalDashboard(SanctumBase):
    account: AccountResponse
    security_score: int
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
    
    # NEW: Explicitly define assets to allow new fields through
    assets: List[AssetResponse] = []