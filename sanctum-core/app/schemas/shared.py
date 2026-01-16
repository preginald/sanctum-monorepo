from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal

# --- CONFIG ---
# Pydantic V2 Configuration Mixin
class SanctumBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# --- SHARED LITE MODELS ---
# Used to break circular dependencies (e.g. Account listing its Invoices)

class InvoiceLite(SanctumBase):
    id: UUID
    status: str
    total_amount: Decimal

class ArticleLite(SanctumBase):
    id: UUID
    title: str
    slug: str
    identifier: Optional[str] = None

class SearchResult(SanctumBase):
    id: UUID | int
    type: str # 'ticket', 'client', 'contact', 'wiki'
    title: str
    subtitle: Optional[str] = None
    link: str