from typing import Optional, List
from uuid import UUID
from datetime import datetime
from .shared import SanctumBase


class ArtefactCreate(SanctumBase):
    name: str
    artefact_type: str  # file, url, code_path, document, credential_ref
    url: Optional[str] = None
    description: Optional[str] = None
    account_id: Optional[UUID] = None


class ArtefactUpdate(SanctumBase):
    name: Optional[str] = None
    artefact_type: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    account_id: Optional[UUID] = None


class ArtefactLinkResponse(SanctumBase):
    id: UUID
    artefact_id: UUID
    linked_entity_type: str
    linked_entity_id: UUID
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
    links: List[ArtefactLinkResponse] = []
