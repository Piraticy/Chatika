from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class StatusCreateInput(BaseModel):
    text: Optional[str] = Field(default=None, max_length=280)
    media_url: Optional[str] = Field(default=None, max_length=255)


class StatusOut(BaseModel):
    id: str
    author_id: str
    username: str
    avatar_url: Optional[str] = None
    text: Optional[str] = None
    media_url: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    is_official: bool = False
    is_own: bool = False
