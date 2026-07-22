from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CreateRoomInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    participant_ids: list[str] = Field(default_factory=list)


class InviteMemberInput(BaseModel):
    username: str = Field(min_length=3, max_length=40)


class StartDirectChatInput(BaseModel):
    username: str = Field(min_length=3, max_length=40)


class CreateGroupInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    usernames: list[str] = Field(min_length=1, max_length=99)


class RoomParticipantOut(BaseModel):
    id: str
    username: str
    avatar_url: Optional[str] = None
    is_online: bool
    last_seen_at: Optional[datetime] = None


class RoomOut(BaseModel):
    id: str
    name: str
    is_group: bool
    created_by: Optional[str]
    participant_ids: list[str] = Field(default_factory=list)
    participants: list[RoomParticipantOut] = Field(default_factory=list)


class SendMessageInput(BaseModel):
    room_id: str
    message_type: str = Field(default='text', max_length=20)
    is_encrypted: bool = False
    sender_key_id: Optional[str] = Field(default=None, max_length=80)
    encrypted_body: Optional[str] = Field(default=None, max_length=12000)
    text: Optional[str] = Field(default=None, max_length=4000)
    media_url: Optional[str] = Field(default=None, max_length=255)


class MessageOut(BaseModel):
    id: str
    room_id: str
    sender_id: str
    sender_username: Optional[str] = None
    message_type: str
    is_encrypted: bool
    sender_key_id: Optional[str]
    encrypted_body: Optional[str]
    reaction_users: dict[str, list[str]] = Field(default_factory=dict)
    text: Optional[str]
    media_url: Optional[str]
    created_at: datetime


class MessageReactionInput(BaseModel):
    room_id: str
    emoji: str = Field(min_length=1, max_length=24)
