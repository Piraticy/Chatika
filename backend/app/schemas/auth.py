from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RegisterInput(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=8, max_length=120)
    device_name: str = Field(default='Unknown Device', max_length=120)
    phone_number: Optional[str] = Field(default=None, min_length=7, max_length=20)


class LoginInput(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str
    device_name: str = Field(default='Unknown Device', max_length=120)


class RefreshInput(BaseModel):
    refresh_token: str


class LogoutInput(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'


class UserMe(BaseModel):
    id: str
    username: str
    phone_number: Optional[str]
    avatar_url: Optional[str]
    is_admin: bool
    is_approved: bool
    is_online: bool
    last_seen_at: Optional[datetime]


class ProfileUpdateInput(BaseModel):
    avatar_url: Optional[str] = Field(default=None, max_length=255)
