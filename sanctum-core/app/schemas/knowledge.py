from typing import Optional, List
from uuid import UUID
from datetime import datetime
from .shared import SanctumBase
from .artefacts import ArtefactLite

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
    change_comment: Optional[str] = None

class ArticleSectionPatch(SanctumBase):
    heading: str  # Exact heading string e.g. "## Milestone Commands"
    content: str  # New section content (excluding the heading line itself)
    change_comment: Optional[str] = None

class ArticleHistoryResponse(SanctumBase):
    id: UUID
    article_id: UUID
    title: str
    version: str
    snapshot_at: datetime
    author_name: Optional[str] = None
    section_heading: Optional[str] = None  # None = whole-article change
    diff_before: Optional[str] = None
    diff_after: Optional[str] = None
    change_comment: Optional[str] = None

class ArticleRevertRequest(SanctumBase):
    fields: Optional[List[str]] = None  # ["content", "title"] — defaults to both if omitted
    change_comment: Optional[str] = None

class RelatedArticleResponse(SanctumBase):
    id: UUID
    title: str
    slug: str
    identifier: Optional[str] = None
    category: Optional[str] = None

class ArticleResponse(ArticleCreate):
    id: UUID
    author_id: Optional[UUID] = None
    author_name: Optional[str] = None
    history: list[ArticleHistoryResponse] = []
    related_articles: list[RelatedArticleResponse] = []
    artefacts: List[ArtefactLite] = []
    # Expand contract count fields (SYS-032)
    revision_count: Optional[int] = None
    related_article_count: Optional[int] = None
    artefact_count: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class ArticleEmailRequest(SanctumBase):
    to_email: str
    cc_emails: list[str] = []
    subject: Optional[str] = None
    message: Optional[str] = None
    recipient_contact_id: Optional[UUID] = None
