from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class StartCallInput(BaseModel):
    chat_room_id: Optional[str] = None
    participant_ids: list[str] = Field(default_factory=list)


class JoinCallInput(BaseModel):
    call_room_id: str


class CallRoomOut(BaseModel):
    id: str
    chat_room_id: Optional[str]
    created_by: str
    ended_at: Optional[datetime]
