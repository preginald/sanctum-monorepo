from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import Field
from .shared import SanctumBase


class ArtefactCreate(SanctumBase):
    name: str
    artefact_type: str  # file, url, code_path, document, credential_ref
    url: Optional[str] = None
    description: Optional[str] = None
    account_id: Optional[UUID] = None
    content: Optional[str] = None
    status: Optional[str] = "draft"
    category: Optional[str] = None
    sensitivity: Optional[str] = "internal"
    metadata: Optional[Dict[str, Any]] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    superseded_by: Optional[UUID] = None


class ArtefactUpdate(SanctumBase):
    name: Optional[str] = None
    artefact_type: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    account_id: Optional[UUID] = None
    content: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    sensitivity: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    superseded_by: Optional[UUID] = None
    change_comment: Optional[str] = None


class ArtefactRevertRequest(SanctumBase):
    fields: Optional[List[str]] = None  # ["content", "name"] — defaults to both if omitted
    change_comment: Optional[str] = None


class ArtefactLinkResponse(SanctumBase):
    id: UUID
    artefact_id: UUID
    linked_entity_type: str
    linked_entity_id: str  # String to support both integer (ticket) and UUID (account/article) PKs
    linked_entity_name: Optional[str] = None
    created_at: Optional[datetime] = None


class ArtefactLite(SanctumBase):
    id: UUID
    name: str
    artefact_type: str
    url: Optional[str] = None


class ArtefactResponse(SanctumBase):
    id: UUID
    name: str
    artefact_type: str
    url: Optional[str] = None
    description: Optional[str] = None
    account_id: Optional[UUID] = None
    account_name: Optional[str] = None
    created_by: Optional[UUID] = None
    creator_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_deleted: bool = False
    version: Optional[str] = "v1.0"
    content: Optional[str] = None
    status: Optional[str] = "draft"
    category: Optional[str] = None
    sensitivity: Optional[str] = "internal"
    metadata: Optional[Dict[str, Any]] = Field(default=None, validation_alias='artefact_metadata')
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    superseded_by: Optional[UUID] = None
    available_transitions: List[str] = []
    links: List[ArtefactLinkResponse] = []


class ArtefactHistoryResponse(SanctumBase):
    id: UUID
    artefact_id: UUID
    name: str
    version: str
    snapshot_at: datetime
    author_name: Optional[str] = None
    content: Optional[str] = None
    diff_before: Optional[str] = None
    diff_after: Optional[str] = None
    change_comment: Optional[str] = None
