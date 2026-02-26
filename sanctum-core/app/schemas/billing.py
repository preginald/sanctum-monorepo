from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from .shared import SanctumBase

# --- PRODUCTS ---
class ProductCreate(SanctumBase):
    name: str
    description: Optional[str] = None
    type: str 
    unit_price: Decimal # FIXED: Decimal
    is_recurring: bool = False
    billing_frequency: Optional[str] = None

# NEW: Update Schema (Everything Optional)
class ProductUpdate(SanctumBase):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    unit_price: Optional[Decimal] = None
    is_recurring: Optional[bool] = None
    billing_frequency: Optional[str] = None

class ProductResponse(ProductCreate):
    id: UUID
    is_active: bool

# --- INVOICES ---
class InvoiceItemCreate(SanctumBase):
    description: str
    quantity: Decimal = Decimal("1.0")
    unit_price: Decimal = Decimal("0.00")

class InvoiceItemUpdate(SanctumBase):
    description: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None

class InvoiceItemSchema(SanctumBase):
    id: UUID
    description: str
    quantity: Decimal
    unit_price: Decimal
    total: Decimal
    ticket_id: Optional[int] = None
    source_type: Optional[str] = None

class InvoiceDeliveryLogResponse(SanctumBase):
    id: UUID
    sent_at: datetime
    sent_to: str
    sent_cc: Optional[str]
    status: str
    sender_name: Optional[str] = None

class BulkMarkPaidRecipient(SanctumBase):
    invoice_id: str
    email: str
    cc_emails: list[str] = []

class BulkMarkPaidRequest(SanctumBase):
    invoice_ids: list[str]
    payment_method: str
    paid_at: datetime
    send_receipt: bool = False
    recipients: list[BulkMarkPaidRecipient] = []

class InvoiceSendRequest(SanctumBase):
    to_email: str # EmailStr
    cc_emails: List[str] = []
    subject: Optional[str] = None
    message: Optional[str] = None
    recipient_contact_id: Optional[UUID] = None # NEW FIELD

class InvoiceUpdate(SanctumBase):
    status: Optional[str] = None
    due_date: Optional[date] = None
    generated_at: Optional[datetime] = None
    payment_terms: Optional[str] = None
    # NEW: Payment Tracking
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None

class InvoiceResponse(SanctumBase):
    id: UUID
    account_id: UUID
    account_name: Optional[str] = None
    status: str
    subtotal_amount: Decimal
    gst_amount: Decimal
    total_amount: Decimal
    payment_terms: str
    due_date: Optional[date] = None
    generated_at: datetime
    pdf_path: Optional[str] = None
    # NEW: Payment Tracking
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    
    items: List[InvoiceItemSchema] = []
    delivery_logs: List[InvoiceDeliveryLogResponse] = []
    suggested_cc: List[str] = []
    renewal_asset: Optional[dict] = None