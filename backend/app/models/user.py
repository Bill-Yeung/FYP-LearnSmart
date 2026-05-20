from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import datetime
from uuid import UUID
from enum import Enum


class UserRole(str, Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class UserBase(BaseModel):
    username: str = Field(min_length = 3, max_length = 50)
    email: EmailStr
    display_name: str | None = Field(default = None, max_length = 100)
    preferred_language: str = Field(default = "en", max_length = 10)


class UserCreate(UserBase):
    password: str = Field(min_length = 8)
    role: UserRole = UserRole.student

class UserUpdate(BaseModel):
    display_name: str | None = Field(default = None, max_length = 100)
    preferred_language: str | None = Field(default = None, max_length = 10)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length = 8)


class UserResponse(UserBase):
    id: UUID
    role: UserRole
    is_active: bool
    email_verified: bool
    created_at: datetime
    last_login: datetime | None = None

    class Config:
        from_attributes = True

class UserProfileResponse(BaseModel):
    user_id: UUID
    bio: str | None = None
    avatar_url: str | None = None
    organization: str | None = None
    department: str | None = None
    level: str | None = None
    personal_interests: list[str] | None = None
    timezone: str = "UTC"

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class TokenPayload(BaseModel):
    sub: UUID  # user id
    exp: datetime
    role: UserRole


class UserSessionResponse(BaseModel):
    id: UUID
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime
    last_activity: datetime

    class Config:
        from_attributes = True


class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetVerifyOTP(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6, pattern="^[0-9]{6}$")
    new_password: str = Field(min_length=8)

class UserPreferencesResponse(BaseModel):
    user_id: UUID
    email_notifications: bool
    push_notifications: bool
    study_reminders: bool
    community_updates: bool
    profile_visibility: str
    show_online_status: bool
    allow_friend_requests: bool

    class Config:
        from_attributes = True

class UserPreferencesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email_notifications: bool | None = None
    push_notifications: bool | None = None
    study_reminders: bool | None = None
    community_updates: bool | None = None
    profile_visibility: str | None = Field(default=None, pattern="^(public|friends|private)$")
    show_online_status: bool | None = None
    allow_friend_requests: bool | None = None

class EmailChangeRequest(BaseModel):
    new_email: EmailStr

class EmailChangeVerify(BaseModel):
    otp: str = Field(min_length=6, max_length=6, pattern="^[0-9]{6}$")
