from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Float, Date, Text, Table
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import text, func
from sqlalchemy.types import TIMESTAMP
from .database import Base
from datetime import datetime

# 1. ASSOCIATION TABLES
ticket_contacts = Table('ticket_contacts', Base.metadata,
    Column('ticket_id', Integer, ForeignKey('tickets.id')),
    Column('contact_id', UUID(as_uuid=True), ForeignKey('contacts.id'))
)

ticket_articles = Table('ticket_articles', Base.metadata,
    Column('ticket_id', Integer, ForeignKey('tickets.id')),
    Column('article_id', UUID(as_uuid=True), ForeignKey('articles.id'))
)

# 2. CORE MODELS

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    full_name = Column(String)
    role = Column(String) # 'admin', 'tech', 'client'
    access_scope = Column(String)
    is_active = Column(Boolean, default=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    
    account = relationship("Account", foreign_keys=[account_id])

class Account(Base):
    __tablename__ = "accounts"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String)
    type = Column(String)
    brand_affinity = Column(String)
    status = Column(String)
    billing_email = Column(String, nullable=True) 
    audit_data = Column(JSONB)

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

    account = relationship("Account", back_populates="contacts")
    subordinates = relationship("Contact", backref=backref('manager', remote_side=[id]))

class Deal(Base):
    __tablename__ = "deals"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    title = Column(String)
    amount = Column(Float)
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
    override_price = Column(Float, nullable=True)
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
    budget_cost = Column(Float, default=0.0)
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
    budget = Column(Float, default=0.0)
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
    billable_amount = Column(Float, default=0.0)
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
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True)
    
    subject = Column(String)
    description = Column(Text)
    status = Column(String, default='new')
    priority = Column(String, default='normal')
    resolution = Column(Text)

    milestone_id = Column(UUID(as_uuid=True), ForeignKey("milestones.id"), nullable=True)
    is_deleted = Column(Boolean, default=False)
    ticket_type = Column(String, default='support')
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    closed_at = Column(TIMESTAMP(timezone=True))

    account = relationship("Account", back_populates="tickets")
    contact = relationship("Contact", foreign_keys=[contact_id])
    contacts = relationship("Contact", secondary=ticket_contacts, backref="tickets")
    
    comments = relationship("Comment", back_populates="ticket", order_by="desc(Comment.created_at)")
    time_entries = relationship("TicketTimeEntry", back_populates="ticket", cascade="all, delete-orphan")
    materials = relationship("TicketMaterial", back_populates="ticket", cascade="all, delete-orphan")
    milestone = relationship("Milestone", back_populates="tickets")
    articles = relationship("Article", secondary=ticket_articles, backref="tickets")

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

    ticket = relationship("Ticket", back_populates="time_entries")
    user = relationship("User") 
    product = relationship("Product")

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
        if not self.product: return 0.0
        return round((self.duration_minutes / 60) * self.product.unit_price, 2)

class TicketMaterial(Base):
    __tablename__ = "ticket_materials"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    ticket = relationship("Ticket", back_populates="materials")
    product = relationship("Product")

    @property
    def product_name(self): return self.product.name if self.product else "Unknown Item"
    @property
    def unit_price(self): return self.product.unit_price if self.product else 0.0
    @property
    def calculated_value(self):
        if not self.product: return 0.0
        return round(self.quantity * self.product.unit_price, 2)

class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String)
    description = Column(Text)
    type = Column(String) 
    unit_price = Column(Float)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class AuditReport(Base):
    __tablename__ = "audit_reports"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=True)
    security_score = Column(Integer, default=0)
    infrastructure_score = Column(Integer, default=0)
    report_pdf_path = Column(String, nullable=True)
    status = Column(String, default="draft")
    content = Column(JSONB, default={})
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    finalized_at = Column(TIMESTAMP(timezone=True))

    account = relationship("Account")
    deal = relationship("Deal")
    comments = relationship("Comment", back_populates="audit", order_by="desc(Comment.created_at)")

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    status = Column(String, default='draft')
    subtotal_amount = Column(Float, default=0.0)
    gst_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    payment_terms = Column(String, default='Net 14 Days')
    due_date = Column(Date, nullable=True)
    generated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    pdf_path = Column(String, nullable=True)

    account = relationship("Account", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    delivery_logs = relationship("InvoiceDeliveryLog", back_populates="invoice", order_by="desc(InvoiceDeliveryLog.sent_at)")

class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"))
    description = Column(String)
    quantity = Column(Float)
    unit_price = Column(Float)
    total = Column(Float)
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
    ticket = relationship("Ticket", back_populates="comments")
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
    
    # Metadata for the UI (Matches the screenshot)
    category = Column(String, default="wiki") # sop, template, wiki
    identifier = Column(String, nullable=True) # e.g., "DS-SOP-001"
    version = Column(String, default="v1.0")   # e.g., "v1.1"
    
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    author = relationship("User")

