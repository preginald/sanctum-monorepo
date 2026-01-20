from typing import Optional
from uuid import UUID
from datetime import datetime
from .shared import SanctumBase

# --- COMMENTS (Shared but placed here for now) ---
class CommentCreate(SanctumBase):
    body: str
    visibility: str = 'internal'
    ticket_id: Optional[int] = None
    deal_id: Optional[UUID] = None
    audit_id: Optional[UUID] = None

class CommentResponse(SanctumBase):
    id: UUID
    author_name: str
    body: str
    visibility: str
    created_at: datetime

# --- WIKI ---
class ArticleCreate(SanctumBase):
    title: str
    slug: str
    content: str
    category: str = 'wiki'
    identifier: Optional[str] = None
    version: str = 'v1.0'

class ArticleUpdate(SanctumBase):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    identifier: Optional[str] = None
    version: Optional[str] = None

class ArticleResponse(ArticleCreate):
    id: UUID
    author_id: Optional[UUID] = None
    author_name: Optional[str] = None # NEW
    created_at: datetime
    updated_at: Optional[datetime] = None