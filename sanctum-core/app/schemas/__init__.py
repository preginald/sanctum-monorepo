from .shared import InvoiceLite, ArticleLite, SearchResult
from .auth import (
    Token, TokenData, UserResponse, ClientUserCreate, 
    TwoFASetupResponse, TwoFAVerify,
    PasswordSetRequest, InviteRequest 
)
from .billing import (
    ProductCreate, ProductUpdate, ProductResponse, 
    InvoiceItemCreate, InvoiceItemUpdate, InvoiceItemSchema, 
    InvoiceDeliveryLogResponse, InvoiceSendRequest, 
    InvoiceUpdate, InvoiceResponse
)
from .crm import (
    AccountCreate, AccountUpdate, AccountResponse, 
    ContactCreate, ContactUpdate, ContactResponse
)
from .strategy import (
    CampaignTargetFilter, CampaignTargetAddResult, CampaignTargetResponse,
    CampaignCreate, CampaignUpdate, CampaignResponse,
    DealCreate, DealUpdate, DealResponse,
    MilestoneReorderRequest, MilestoneCreate, MilestoneUpdate, MilestoneResponse,
    ProjectCreate, ProjectUpdate, ProjectResponse,
    AuditCreate, AuditUpdate, AuditResponse, AuditItem
)
from .operations import (
    TimeEntryCreate, TimeEntryUpdate, TimeEntryResponse,
    TicketMaterialCreate, TicketMaterialUpdate, TicketMaterialResponse,
    TicketCreate, TicketUpdate, TicketResponse, LeadSchema
)
from .knowledge import (
    CommentCreate, CommentResponse,
    ArticleCreate, ArticleUpdate, ArticleResponse, ArticleHistoryResponse, ArticleEmailRequest
)

from .assets import AssetCreate, AssetUpdate, AssetResponse

from .portal import PortalDashboard, AccountDetail, QuestionnaireSubmit

from .automation import (
    AutomationCreate, AutomationUpdate, AutomationResponse, AutomationLogResponse
)

# UPDATED: Added PreferenceUpdate and PreferenceResponse
from .notification import (
    NotificationResponse, NotificationUpdate, 
    PreferenceUpdate, PreferenceResponse
)

# Analytics
from pydantic import BaseModel
class DashboardStats(BaseModel):
    revenue_realized: float    
    pipeline_value: float      
    active_audits: int
    open_tickets: int
    critical_tickets: int