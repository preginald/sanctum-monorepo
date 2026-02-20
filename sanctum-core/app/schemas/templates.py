from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
import uuid


class SanctumBase(BaseModel):
    model_config = {"from_attributes": True}


# ─────────────────────────────────────
# TEMPLATE ITEM (ticket stub)
# ─────────────────────────────────────

class TemplateItemCreate(SanctumBase):
    subject: str
    description: Optional[str] = None
    item_type: str = "task"
    priority: str = "normal"
    sequence: int = 1
    config: Optional[Dict[str, Any]] = {}


class TemplateItemUpdate(SanctumBase):
    subject: Optional[str] = None
    description: Optional[str] = None
    item_type: Optional[str] = None
    priority: Optional[str] = None
    sequence: Optional[int] = None
    config: Optional[Dict[str, Any]] = None


class TemplateItemResponse(TemplateItemCreate):
    id: uuid.UUID
    section_id: uuid.UUID
    created_at: Optional[datetime] = None


# ─────────────────────────────────────
# TEMPLATE SECTION (milestone stub)
# ─────────────────────────────────────

class TemplateSectionCreate(SanctumBase):
    name: str
    description: Optional[str] = None
    sequence: int = 1
    items: Optional[List[TemplateItemCreate]] = []


class TemplateSectionUpdate(SanctumBase):
    name: Optional[str] = None
    description: Optional[str] = None
    sequence: Optional[int] = None


class TemplateSectionResponse(SanctumBase):
    id: uuid.UUID
    template_id: uuid.UUID
    name: str
    description: Optional[str] = None
    sequence: int
    items: List[TemplateItemResponse] = []
    created_at: Optional[datetime] = None


# ─────────────────────────────────────
# TEMPLATE (top-level)
# ─────────────────────────────────────

class TemplateCreate(SanctumBase):
    name: str
    description: Optional[str] = None
    template_type: str                          # "project" | "ticket" | "deal" | "campaign"
    category: str = "general"
    tags: Optional[List[str]] = []
    icon: Optional[str] = None
    sections: Optional[List[TemplateSectionCreate]] = []


class TemplateUpdate(SanctumBase):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class TemplateResponse(SanctumBase):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    template_type: str
    category: str
    tags: List[str] = []
    icon: Optional[str] = None
    times_applied: int = 0
    is_active: bool
    source_template_id: Optional[uuid.UUID] = None
    created_by_id: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    sections: List[TemplateSectionResponse] = []

    # Computed fields populated by router
    section_count: Optional[int] = None
    item_count: Optional[int] = None
    cloned_from_name: Optional[str] = None     # name of source template if cloned


# ─────────────────────────────────────
# IMPORT (JSON bulk create)
# ─────────────────────────────────────

class TemplateImport(SanctumBase):
    """
    Portable JSON structure for importing a template.
    Identical to TemplateCreate — named separately for intent clarity.
    """
    name: str
    description: Optional[str] = None
    template_type: str
    category: str = "general"
    tags: Optional[List[str]] = []
    icon: Optional[str] = None
    sections: Optional[List[TemplateSectionCreate]] = []


# ─────────────────────────────────────
# APPLY (scaffold real entities)
# ─────────────────────────────────────

class TemplateApply(SanctumBase):
    account_id: uuid.UUID
    project_name: Optional[str] = None         # override template name as project name
    project_description: Optional[str] = None


class TemplateApplyResponse(SanctumBase):
    template_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    entity_name: str
    milestones_created: int
    tickets_created: int


# ─────────────────────────────────────
# CLONE
# ─────────────────────────────────────

class TemplateClone(SanctumBase):
    name: str                                  # new name for the cloned template


# ─────────────────────────────────────
# APPLICATION LOG
# ─────────────────────────────────────

class TemplateApplicationResponse(SanctumBase):
    id: uuid.UUID
    template_id: uuid.UUID
    applied_by_id: Optional[uuid.UUID] = None
    account_id: Optional[uuid.UUID] = None
    entity_type: str
    entity_id: Optional[uuid.UUID] = None
    applied_at: datetime
