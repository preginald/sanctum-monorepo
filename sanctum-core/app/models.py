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

class Account(Base):
    __tablename__ = "accounts"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String)
    type = Column(String)
    brand_affinity = Column(String)
    status = Column(String)
    audit_data = Column(JSONB)

    deals = relationship("Deal", back_populates="account")
    tickets = relationship("Ticket", back_populates="account")
    contacts = relationship("Contact", back_populates="account")

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

    account = relationship("Account", back_populates="deals")
    comments = relationship("Comment", back_populates="deal", order_by="desc(Comment.created_at)")

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    assigned_tech_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    subject = Column(String)
    description = Column(Text)
    status = Column(String, default='new')
    priority = Column(String, default='normal')
    resolution = Column(Text)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    closed_at = Column(TIMESTAMP(timezone=True))

    account = relationship("Account", back_populates="tickets")
    contacts = relationship("Contact", secondary=ticket_contacts, backref="tickets")
    comments = relationship("Comment", back_populates="ticket", order_by="desc(Comment.created_at)")
    
    # Relationships
    time_entries = relationship("TicketTimeEntry", back_populates="ticket", cascade="all, delete-orphan")

    # Dynamic Properties
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
    
    start_time = Column(TIMESTAMP(timezone=True), nullable=False)
    end_time = Column(TIMESTAMP(timezone=True), nullable=False)
    description = Column(String, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    ticket = relationship("Ticket", back_populates="time_entries")
    user = relationship("User") 

    # Properties
    @property
    def duration_minutes(self):
        if self.start_time and self.end_time:
            delta = self.end_time - self.start_time
            return int(delta.total_seconds() / 60)
        return 0

    @property
    def user_name(self):
        return self.user.full_name if self.user else "Unknown"

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