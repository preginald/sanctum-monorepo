from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey, Table, Numeric, Float, Date, func, ARRAY, DateTime
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.types import JSON
from sqlalchemy import Enum as SAEnum 
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import text, func
from sqlalchemy.types import TIMESTAMP
from .database import Base
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import uuid



# 1. ASSOCIATION TABLES

ticket_contacts = Table('ticket_contacts', Base.metadata,
    Column('ticket_id', Integer, ForeignKey('tickets.id'), primary_key=True),
    Column('contact_id', UUID(as_uuid=True), ForeignKey('contacts.id'), primary_key=True)
)

ticket_articles = Table('ticket_articles', Base.metadata,
    Column('ticket_id', Integer, ForeignKey('tickets.id'), primary_key=True),
    Column('article_id', UUID(as_uuid=True), ForeignKey('articles.id'), primary_key=True)
)

ticket_assets = Table('ticket_assets', Base.metadata,
    Column('ticket_id', Integer, ForeignKey('tickets.id'), primary_key=True),
    Column('asset_id', UUID(as_uuid=True), ForeignKey('assets.id'), primary_key=True)
)

# 2. CORE MODELS

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    full_name = Column(String)
    role = Column(String) 
    access_scope = Column(String)
    is_active = Column(Boolean, default=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    
    totp_secret = Column(String, nullable=True)
    
    account = relationship("Account", foreign_keys=[account_id])

    @property
    def has_2fa(self):
        return bool(self.totp_secret)

class Account(Base):
    __tablename__ = "accounts"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String)
    type = Column(String)
    brand_affinity = Column(String)
    status = Column(String)
    billing_email = Column(String, nullable=True) 
    audit_data = Column(JSON, default={}) 

    # NEW: Asset Ingest Security
    # Unique token for this client to run the 'Sanctum Agent' script
    ingest_token = Column(UUID(as_uuid=True), server_default=text("gen_random_uuid()"), unique=True)

    deals = relationship("Deal", back_populates="account")
    tickets = relationship("Ticket", back_populates="account")
    contacts = relationship("Contact", back_populates="account")
    invoices = relationship("Invoice", back_populates="account")
    projects = relationship("Project", back_populates="account")

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String)
    phone = Column(String)
    is_primary_contact = Column(Boolean, default=False)
    persona = Column(String)
    reports_to_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True)
    
    # NEW: Preference store for non-users (External Contacts)
    notification_preferences = Column(JSON, default={}) 

    account = relationship("Account", back_populates="contacts")
    subordinates = relationship("Contact", backref=backref('manager', remote_side=[id]))

class Deal(Base):
    __tablename__ = "deals"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    title = Column(String)
    amount = Column(Numeric(12,2))
    stage = Column(String, default='Infiltration')
    probability = Column(Integer, default=10)
    expected_close_date = Column(Date, nullable=True)
    source_campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True)

    account = relationship("Account", back_populates="deals")
    comments = relationship("Comment", back_populates="deal", order_by="desc(Comment.created_at)")
    items = relationship("DealItem", back_populates="deal", cascade="all, delete-orphan")
    campaign = relationship("Campaign", back_populates="deals")

class DealItem(Base):
    __tablename__ = "deal_items"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"))
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    override_price = Column(Numeric(12, 2), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    deal = relationship("Deal", back_populates="items")
    product = relationship("Product")

class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String)
    type = Column(String)
    status = Column(String, default='draft')
    brand_affinity = Column(String, default='ds')
    subject_template = Column(String, nullable=True)
    body_template = Column(Text, nullable=True)
    budget_cost = Column(Numeric(12, 2), default=0.0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    targets = relationship("CampaignTarget", back_populates="campaign", cascade="all, delete-orphan")
    deals = relationship("Deal", back_populates="campaign")
    
    @property
    def target_count(self): return len(self.targets)
    @property
    def sent_count(self): return len([t for t in self.targets if t.status == 'sent'])
    @property
    def deal_count(self): return len(self.deals)
    @property
    def total_deal_value(self): return sum([d.amount for d in self.deals if d.amount])

class CampaignTarget(Base):
    __tablename__ = "campaign_targets"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"))
    status = Column(String, default='targeted')
    sent_at = Column(TIMESTAMP(timezone=True), nullable=True)

    campaign = relationship("Campaign", back_populates="targets")
    contact = relationship("Contact")

class Project(Base):
    __tablename__ = "projects"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=True)
    name = Column(String)
    description = Column(Text)
    status = Column(String, default='planning')
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    budget = Column(Numeric(12, 2), default=0.0)
    is_deleted = Column(Boolean, default=False) 
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    account = relationship("Account", back_populates="projects")
    deal = relationship("Deal")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")

class Milestone(Base):
    __tablename__ = "milestones"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"))
    name = Column(String)
    due_date = Column(Date, nullable=True)
    status = Column(String, default='pending')
    billable_amount = Column(Numeric(12, 2), default=0.0)
    sequence = Column(Integer, default=1)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="milestones")
    tickets = relationship("Ticket", back_populates="milestone")
    invoice = relationship("Invoice")

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    assigned_tech_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # LEGACY FIELD: Do not remove yet, but Logic will migrate to 'contacts' relationship
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True)
    
    subject = Column(String)
    description = Column(Text)
    status = Column(String, default='new')
    priority = Column(String, default='normal')
    resolution = Column(Text)
    resolution_comment_id = Column(UUID(as_uuid=True), ForeignKey("comments.id"), nullable=True)

    milestone_id = Column(UUID(as_uuid=True), ForeignKey("milestones.id"), nullable=True)
    is_deleted = Column(Boolean, default=False)
    ticket_type = Column(String, default='support')
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    closed_at = Column(TIMESTAMP(timezone=True))

    account = relationship("Account", back_populates="tickets")
    contact = relationship("Contact", foreign_keys=[contact_id]) # Legacy Relationship
    
    # NEW: The Many-to-Many Relationship
    contacts = relationship("Contact", secondary=ticket_contacts, backref="tickets")
    
    comments = relationship(
        "Comment", 
        back_populates="ticket", 
        order_by="desc(Comment.created_at)",
        foreign_keys="[Comment.ticket_id]"
    )

    time_entries = relationship("TicketTimeEntry", back_populates="ticket", cascade="all, delete-orphan")
    materials = relationship("TicketMaterial", back_populates="ticket", cascade="all, delete-orphan")
    milestone = relationship("Milestone", back_populates="tickets")
    articles = relationship("Article", secondary=ticket_articles, backref="tickets")
    resolution_comment = relationship(
        "Comment", 
        foreign_keys=[resolution_comment_id],
        post_update=True 
    )
    assets = relationship("Asset", secondary=ticket_assets, backref="tickets")

    @property
    def total_hours(self):
        total_mins = 0
        for entry in self.time_entries:
            if entry.start_time and entry.end_time:
                delta = entry.end_time - entry.start_time
                total_mins += int(delta.total_seconds() / 60)
        return round(total_mins / 60, 2)

class TicketTimeEntry(Base):
    __tablename__ = "ticket_time_entries"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id")) 
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    start_time = Column(TIMESTAMP(timezone=True), nullable=False)
    end_time = Column(TIMESTAMP(timezone=True), nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    # FINANCIAL LOCKING
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)

    ticket = relationship("Ticket", back_populates="time_entries")
    user = relationship("User") 
    product = relationship("Product")
    invoice = relationship("Invoice")

    @property
    def duration_minutes(self):
        if self.start_time and self.end_time:
            delta = self.end_time - self.start_time
            return int(delta.total_seconds() / 60)
        return 0
    @property
    def user_name(self): return self.user.full_name if self.user else "Unknown"
    @property
    def service_name(self): return self.product.name if self.product else "General Labor"
    @property
    def calculated_value(self):
        if not self.product: return Decimal("0.00")
        hours = Decimal(self.duration_minutes) / Decimal("60")
        rate = self.product.unit_price
        if not isinstance(rate, Decimal): rate = Decimal(str(rate))
        total = hours * rate
        return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

class TicketMaterial(Base):
    __tablename__ = "ticket_materials"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    # FINANCIAL LOCKING
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)

    ticket = relationship("Ticket", back_populates="materials")
    product = relationship("Product")
    invoice = relationship("Invoice")

    @property
    def product_name(self): return self.product.name if self.product else "Unknown Item"
    @property
    def unit_price(self): return self.product.unit_price if self.product else 0.0
    @property
    def calculated_value(self):
        if not self.product: return Decimal("0.00")
        qty = Decimal(self.quantity)
        rate = self.product.unit_price
        if not isinstance(rate, Decimal): rate = Decimal(str(rate))
        total = qty * rate
        return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String)
    description = Column(Text)
    type = Column(String) 
    unit_price = Column(Numeric(12, 2))
    is_active = Column(Boolean, default=True)
    is_recurring = Column(Boolean, default=False)
    billing_frequency = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class AuditTemplate(Base):
    __tablename__ = "audit_templates"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False)
    framework = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, default='security')  # NEW: 'security', 'infrastructure', 'digital_presence', etc.
    category_structure = Column(JSON, default=[])
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    submissions = relationship("AuditSubmission", back_populates="template", cascade="all, delete-orphan")

class AuditSubmission(Base):
    __tablename__ = "audit_submissions"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    audit_report_id = Column(UUID(as_uuid=True), ForeignKey("audit_reports.id"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("audit_templates.id"), nullable=False)
    responses = Column(JSON, default={})  # {control_id: {status: "pass/fail/partial/na", notes: "..."}}
    submitted_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    submitted_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    audit_report = relationship("AuditReport", back_populates="submissions")
    template = relationship("AuditTemplate", back_populates="submissions")
    submitted_by = relationship("User")

class AuditReport(Base):
    __tablename__ = "audit_reports"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("audit_templates.id"), nullable=True)

    # NEW FIELDS FOR THE SENTINEL
    target_url = Column(String, nullable=True)
    scan_status = Column(String, default="idle") # idle, queued, running, completed, failed
    last_scan_at = Column(TIMESTAMP(timezone=True), nullable=True)

    security_score = Column(Integer, default=0)
    infrastructure_score = Column(Integer, default=0)
    report_pdf_path = Column(String, nullable=True)
    status = Column(String, default="draft")
    content = Column(JSON, default={})    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    finalized_at = Column(TIMESTAMP(timezone=True))

    account = relationship("Account")
    deal = relationship("Deal")
    comments = relationship("Comment", back_populates="audit", order_by="desc(Comment.created_at)")
    template = relationship("AuditTemplate")
    submissions = relationship("AuditSubmission", back_populates="audit_report", cascade="all, delete-orphan")

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    status = Column(String, default='draft')
    subtotal_amount = Column(Numeric(12, 2), default=0.0)
    gst_amount = Column(Numeric(12, 2), default=0.0)
    total_amount = Column(Numeric(12, 2), default=0.0)
    payment_terms = Column(String, default='Net 14 Days')
    due_date = Column(Date, nullable=True)
    generated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    pdf_path = Column(String, nullable=True)
    
    # PAYMENT TRACKING
    paid_at = Column(TIMESTAMP(timezone=True), nullable=True)
    payment_method = Column(String, nullable=True)

    account = relationship("Account", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    delivery_logs = relationship("InvoiceDeliveryLog", back_populates="invoice", order_by="desc(InvoiceDeliveryLog.sent_at)")

class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"))
    description = Column(String)
    quantity = Column(Numeric(12, 2))
    unit_price = Column(Numeric(12, 2))
    total = Column(Numeric(12, 2))
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=True)
    source_type = Column(String, nullable=True)
    source_id = Column(UUID(as_uuid=True), nullable=True)

    invoice = relationship("Invoice", back_populates="items")
    ticket = relationship("Ticket") 

class Comment(Base):
    __tablename__ = "comments"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    body = Column(Text)
    visibility = Column(String, default='internal')
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=True)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=True)
    audit_id = Column(UUID(as_uuid=True), ForeignKey("audit_reports.id"), nullable=True)
    
    author = relationship("User")
    ticket = relationship("Ticket", back_populates="comments", foreign_keys=[ticket_id])
    deal = relationship("Deal", back_populates="comments")
    audit = relationship("AuditReport", back_populates="comments")

class InvoiceDeliveryLog(Base):
    __tablename__ = "invoice_delivery_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"))
    sent_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    sent_to = Column(String)
    sent_cc = Column(String, nullable=True)
    status = Column(String, default='sent')
    sent_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", back_populates="delivery_logs")
    sender = relationship("User")

class Article(Base):
    __tablename__ = "articles"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True)
    content = Column(Text)
    category = Column(String, default="wiki") 
    identifier = Column(String, nullable=True)
    version = Column(String, default="v1.0")
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    author = relationship("User")

class ArticleHistory(Base):
    __tablename__ = "article_history"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    article_id = Column(UUID(as_uuid=True), ForeignKey("articles.id"))
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title = Column(String)
    content = Column(Text)
    version = Column(String) 
    snapshot_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    article = relationship("Article", backref="history")
    author = relationship("User")

class Asset(Base):
    __tablename__ = "assets"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    name = Column(String) 
    asset_type = Column(String) 
    status = Column(String, default='active') 
    serial_number = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Digital Lifecycle
    expires_at = Column(Date, nullable=True)
    vendor = Column(String, nullable=True) 
    linked_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    auto_invoice = Column(Boolean, default=False)
    
    # NEW: Asset Intelligence (Big Data Ready)
    # Stores flexible specs like {"os": "iOS 17", "cpu": "M1", "ram": "16GB"}
    specs = Column(JSONB, server_default='{}', default={}) 

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    account = relationship("Account", backref="assets")
    linked_product = relationship("Product")

class Automation(Base):
    __tablename__ = "automations"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    event_type = Column(String, nullable=False) 
    action_type = Column(String, nullable=False) 
    config = Column(JSON, default={}) 
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    logs = relationship("AutomationLog", back_populates="automation", cascade="all, delete-orphan")

class AutomationLog(Base):
    __tablename__ = "automation_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    automation_id = Column(UUID(as_uuid=True), ForeignKey("automations.id"))
    triggered_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    status = Column(String) # 'success', 'failure', 'running'
    output = Column(Text, nullable=True) 
    
    automation = relationship("Automation", back_populates="logs")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    
    # UPDATED: Nullable to allow external contacts (e.g. billing email, vendors)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    
    # NEW: Stores the actual target email. Mandatory if user_id is None.
    recipient_email = Column(String, nullable=True, index=True)

    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String, nullable=True) 
    is_read = Column(Boolean, default=False)

    status = Column(String, default='pending') # pending, sent, failed, batched
    priority = Column(String, default='normal') 
    event_type = Column(String, nullable=True)
    
    # NEW: Snapshot of data (ticket_id, subject, etc.) for building Digests later
    event_payload = Column(JSON, default={})
    
    # NEW: Channel Preference (email, in_app, etc)
    delivery_channel = Column(String, default='email')

    batch_id = Column(UUID(as_uuid=True), nullable=True)
    sent_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    user = relationship("User", backref="notifications")

class PasswordToken(Base):
    __tablename__ = "password_tokens"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String, nullable=False, index=True) 
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    user = relationship("User")

class UserNotificationPreference(Base):
    __tablename__ = "user_notification_preferences"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    email_frequency = Column(String, default='realtime') 
    force_critical = Column(Boolean, default=True)
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    user = relationship("User", backref=backref("notification_preferences", uselist=False))


class Vendor(Base):
    """
    Comprehensive vendor/provider catalog for standardized data.
    Used in questionnaire (SearchableSelect), asset management, and lifecycle tracking.
    """
    __tablename__ = "vendors"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    
    # Category determines where vendor appears in UI
    # Values: 'saas', 'antivirus', 'registrar', 'hosting', 'backup', 
    #         'password_manager', 'firewall', 'endpoint_security'
    category = Column(ARRAY(String), nullable=False, index=True, server_default='{}')
    
    # Contact & reference info
    website = Column(String(255))
    support_email = Column(String(255))
    support_phone = Column(String(100))
    account_manager_contact = Column(String(255))
    
    # Lifecycle defaults
    typical_renewal_cycle = Column(Integer)  # in months (12, 24, 36)
    typical_pricing_model = Column(String(50))  # 'per_user', 'flat_rate', 'tiered', 'usage_based'
    
    # Future: Pricing intelligence (Phase 63)
    base_price_aud = Column(Numeric(10, 2))  # Starting price in AUD
    pricing_notes = Column(Text)
    
    # Visual & metadata
    logo_url = Column(String(500))
    description = Column(Text)
    tags = Column(ARRAY(String))  # ['australian', 'enterprise', 'sme', etc.]

    # Risk & Audit Strategy (Phase 63)
    risk_score = Column(Integer, default=0) # 0-10 Scale (0=Low, 10=Critical)
    is_critical = Column(Boolean, default=False) # If True, outage = major incident

    # NEW RISK METRICS
    risk_level = Column(String, default="low") # low, medium, high, critical
    compliance_status = Column(String, default="pending") # compliant, non-compliant, pending
    last_audit_date = Column(DateTime, nullable=True)
    data_access_level = Column(String, default="none") # restricted, internal, confidential, restricted
    
    # For "The Oracle" calculation
    security_score = Column(Integer, default=100) # 0-100 scale
    
    # Admin
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    
    # Relationships
    # assets = relationship("Asset", back_populates="vendor")  # Link to assets using this vendor

    def __repr__(self):
        return f"<Vendor {self.name} ({self.category})>"