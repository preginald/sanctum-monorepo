from pydantic import EmailStr
from typing import Optional
from uuid import UUID
from .shared import SanctumBase

class Token(SanctumBase):
    access_token: str
    token_type: str

class TokenData(SanctumBase):
    email: Optional[str] = None

class UserResponse(SanctumBase):
    id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    access_scope: str
    is_active: bool
    account_id: Optional[UUID] = None

class ClientUserCreate(SanctumBase):
    email: EmailStr
    password: str
    full_name: str