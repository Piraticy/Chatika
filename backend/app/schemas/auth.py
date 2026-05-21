from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RegisterInput(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    phone_number: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=8, max_length=120)
    device_name: str = Field(default='Unknown Device', max_length=120)


class LoginInput(BaseModel):
    phone_number: str
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
    phone_number: str
    is_admin: bool
    is_approved: bool
    is_online: bool
    last_seen_at: Optional[datetime]
