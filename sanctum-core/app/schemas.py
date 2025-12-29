from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

# 1. Login Request
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# 2. User Output (What we send back to the frontend)
# We NEVER send the password_hash back.
class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    access_scope: str
    is_active: bool

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    revenue_mtd: float
    active_audits: int
    open_tickets: int

class AccountResponse(BaseModel):
    id: UUID
    name: str
    type: str
    status: str
    brand_affinity: str
    
    class Config:
        from_attributes = True
