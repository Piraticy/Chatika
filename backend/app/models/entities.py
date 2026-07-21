from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDTimeMixin


class User(Base, UUIDTimeMixin):
    __tablename__ = 'users'

    username: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class SessionToken(Base, UUIDTimeMixin):
    __tablename__ = 'session_tokens'

    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    device_name: Mapped[str] = mapped_column(String(120), default='Unknown Device')
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class ChatRoom(Base, UUIDTimeMixin):
    __tablename__ = 'chat_rooms'

    name: Mapped[str] = mapped_column(String(120))
    is_group: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)


class ChatRoomMember(Base, UUIDTimeMixin):
    __tablename__ = 'chat_room_members'
    __table_args__ = (UniqueConstraint('room_id', 'user_id', name='uq_room_user'),)

    room_id: Mapped[str] = mapped_column(ForeignKey('chat_rooms.id', ondelete='CASCADE'), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    role: Mapped[str] = mapped_column(String(30), default='member')


class Message(Base, UUIDTimeMixin):
    __tablename__ = 'messages'

    room_id: Mapped[str] = mapped_column(ForeignKey('chat_rooms.id', ondelete='CASCADE'), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    message_type: Mapped[str] = mapped_column(String(20), default='text')
    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False)
    sender_key_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    encrypted_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reaction_users_json: Mapped[str] = mapped_column(Text, default='{}')
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    media_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class MediaPreference(Base, UUIDTimeMixin):
    __tablename__ = 'media_preferences'
    __table_args__ = (UniqueConstraint('user_id', name='uq_media_pref_user'),)

    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    storage_mode: Mapped[str] = mapped_column(String(20), default='device')


class BackupSnapshot(Base, UUIDTimeMixin):
    __tablename__ = 'backup_snapshots'

    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    encrypted_payload: Mapped[str] = mapped_column(Text)


class CallRoom(Base, UUIDTimeMixin):
    __tablename__ = 'call_rooms'

    chat_room_id: Mapped[Optional[str]] = mapped_column(ForeignKey('chat_rooms.id', ondelete='SET NULL'), nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class CallParticipant(Base, UUIDTimeMixin):
    __tablename__ = 'call_participants'
    __table_args__ = (UniqueConstraint('call_room_id', 'user_id', name='uq_call_user'),)

    call_room_id: Mapped[str] = mapped_column(ForeignKey('call_rooms.id', ondelete='CASCADE'), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class UserKeyBundle(Base, UUIDTimeMixin):
    __tablename__ = 'user_key_bundles'
    __table_args__ = (UniqueConstraint('user_id', name='uq_user_key_bundle_user'),)

    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    identity_key: Mapped[str] = mapped_column(Text)
    signed_prekey: Mapped[str] = mapped_column(Text)
    signed_prekey_signature: Mapped[str] = mapped_column(Text)
    one_time_prekeys_json: Mapped[str] = mapped_column(Text, default='[]')


class DevicePushToken(Base, UUIDTimeMixin):
    __tablename__ = 'device_push_tokens'
    __table_args__ = (UniqueConstraint('platform', 'token', name='uq_push_platform_token'),)

    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    platform: Mapped[str] = mapped_column(String(20))
    token: Mapped[str] = mapped_column(String(255), index=True)
    device_name: Mapped[str] = mapped_column(String(120), default='Unknown Device')
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
