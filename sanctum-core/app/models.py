from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Float, Date, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import text
from .database import Base

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

    # Relationships
    deals = relationship("Deal", back_populates="account")
    tickets = relationship("Ticket", back_populates="account")
    contacts = relationship("Contact", back_populates="account") # <--- THIS IS THE CRITICAL LINE

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String)
    phone = Column(String)
    is_primary_contact = Column(Boolean, default=False)

    # --- PHASE 7 NEW COLUMNS ---
    persona = Column(String) # 'Decision Maker', 'Champion', 'Blocker'
    reports_to_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True)

    # Relationships
    account = relationship("Account", back_populates="contacts")
    # Adjacency List (The Hierarchy)
    subordinates = relationship("Contact", backref=backref('manager', remote_side=[id]))

class Deal(Base):
    __tablename__ = "deals"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    title = Column(String)
    amount = Column(Float)

    account = relationship("Account", back_populates="deals")

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    subject = Column(String)
    status = Column(String)
    priority = Column(String)

    account = relationship("Account", back_populates="tickets")

class AuditReport(Base):
    __tablename__ = "audit_reports"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    security_score = Column(Integer)
