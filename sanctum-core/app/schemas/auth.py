from pydantic import EmailStr
from typing import Optional
from uuid import UUID
from .shared import SanctumBase

class Token(SanctumBase):
    access_token: str
    token_type: str

class TokenData(SanctumBase):
    email: Optional[str] = None

class TwoFASetupResponse(SanctumBase):
    secret: str
    qr_uri: str

class TwoFAVerify(SanctumBase):
    code: str

class UserResponse(SanctumBase):
    id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    access_scope: str
    is_active: bool
    account_id: Optional[UUID] = None
    has_2fa: bool = False

class ClientUserCreate(SanctumBase):
    email: EmailStr
    password: str
    full_name: str