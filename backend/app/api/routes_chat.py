import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import ChatRoom, ChatRoomMember, DevicePushToken, Message, User
from app.schemas.chat import CreateRoomInput, InviteMemberInput, MessageOut, MessageReactionInput, RoomOut, RoomParticipantOut, SendMessageInput
from app.services.push import push_service
from app.services.ws_manager import ws_manager

router = APIRouter(prefix='/chat', tags=['chat'])


def _room_member_ids(db: Session, room_id: str) -> list[str]:
    members = db.scalars(select(ChatRoomMember).where(ChatRoomMember.room_id == room_id)).all()
    return [m.user_id for m in members]


def _room_participants(db: Session, room_id: str) -> list[RoomParticipantOut]:
    member_ids = _room_member_ids(db, room_id)
    if not member_ids:
        return []
    users = db.scalars(select(User).where(User.id.in_(member_ids))).all()
    users_by_id = {user.id: user for user in users}
    return [
        RoomParticipantOut(
            id=user.id,
            username=user.username,
            is_online=user.is_online,
            last_seen_at=user.last_seen_at,
        )
        for user_id in member_ids
        if (user := users_by_id.get(user_id))
    ]


def _room_out(db: Session, room: ChatRoom) -> RoomOut:
    participants = _room_participants(db, room.id)
    return RoomOut(
        id=room.id,
        name=room.name,
        is_group=room.is_group,
        created_by=room.created_by,
        participant_ids=[participant.id for participant in participants],
        participants=participants,
    )


def _parse_reactions(message: Message) -> dict[str, list[str]]:
    try:
        parsed = json.loads(message.reaction_users_json or '{}')
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    clean: dict[str, list[str]] = {}
    for emoji, users in parsed.items():
        if isinstance(emoji, str) and isinstance(users, list):
            clean[emoji] = [str(uid) for uid in users]
    return clean


def _serialize_message(message: Message, sender_username: str | None = None) -> dict:
    return {
        'id': message.id,
        'room_id': message.room_id,
        'sender_id': message.sender_id,
        'sender_username': sender_username,
        'message_type': message.message_type,
        'is_encrypted': message.is_encrypted,
        'sender_key_id': message.sender_key_id,
        'encrypted_body': message.encrypted_body,
        'reaction_users': _parse_reactions(message),
        'text': message.text,
        'media_url': message.media_url,
        'created_at': message.created_at.isoformat(),
    }


@router.post('/rooms', response_model=RoomOut)
def create_room(data: CreateRoomInput, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> RoomOut:
    participant_ids = list(set([current_user.id, *data.participant_ids]))
    room = ChatRoom(name=data.name, is_group=len(participant_ids) > 2, created_by=current_user.id)
    db.add(room)
    db.commit()
    db.refresh(room)

    for user_id in participant_ids:
        db.add(ChatRoomMember(room_id=room.id, user_id=user_id, role='owner' if user_id == current_user.id else 'member'))
    db.commit()

    return _room_out(db, room)


@router.post('/rooms/{room_id}/invite', response_model=RoomOut)
async def invite_member(
    room_id: str,
    data: InviteMemberInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RoomOut:
    membership = db.scalar(
        select(ChatRoomMember).where(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.user_id == current_user.id,
        )
    )
    if not membership:
        raise HTTPException(status_code=403, detail='Not a member of this room')

    room = db.get(ChatRoom, room_id)
    if not room:
        raise HTTPException(status_code=404, detail='Room not found')

    username = data.username.strip().lstrip('@')
    invitee = db.scalar(select(User).where(func.lower(User.username) == username.lower()))
    if not invitee or not invitee.is_approved:
        raise HTTPException(status_code=404, detail='Approved username not found')
    if invitee.id == current_user.id:
        raise HTTPException(status_code=400, detail='You are already in this room')

    existing = db.scalar(
        select(ChatRoomMember).where(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.user_id == invitee.id,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail='That user is already in this room')

    if len(_room_member_ids(db, room_id)) + 1 > 2:
        room.is_group = True
    db.add(ChatRoomMember(room_id=room_id, user_id=invitee.id, role='member'))
    db.add(room)
    db.commit()
    db.refresh(room)

    room_out = _room_out(db, room)
    await ws_manager.send_user(
        invitee.id,
        {
            'event': 'room:invite',
            'data': {
                'room': room_out.model_dump(mode='json'),
                'invited_by': current_user.username,
            },
        },
    )
    return room_out


@router.get('/rooms', response_model=list[RoomOut])
def list_rooms(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[RoomOut]:
    memberships = db.scalars(select(ChatRoomMember).where(ChatRoomMember.user_id == current_user.id)).all()
    room_ids = [m.room_id for m in memberships]
    if not room_ids:
        return []
    rooms = db.scalars(select(ChatRoom).where(ChatRoom.id.in_(room_ids))).all()
    return [_room_out(db, room) for room in rooms]


@router.post('/messages', response_model=MessageOut)
async def send_message(
    data: SendMessageInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    membership = db.scalar(
        select(ChatRoomMember).where(
            ChatRoomMember.room_id == data.room_id,
            ChatRoomMember.user_id == current_user.id,
        )
    )
    if not membership:
        raise HTTPException(status_code=403, detail='Not a member of this room')
    if data.is_encrypted and not data.encrypted_body:
        raise HTTPException(status_code=400, detail='Encrypted messages require encrypted_body')
    if not data.is_encrypted and not data.text and not data.media_url:
        raise HTTPException(status_code=400, detail='Message must include text, media, or encrypted payload')
    if data.text and len(data.text) > settings.message_max_length:
        raise HTTPException(status_code=400, detail='Message text exceeds max length')

    message = Message(
        room_id=data.room_id,
        sender_id=current_user.id,
        message_type=data.message_type,
        is_encrypted=data.is_encrypted,
        sender_key_id=data.sender_key_id,
        encrypted_body=data.encrypted_body,
        text=data.text,
        media_url=data.media_url,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    payload = {'event': 'message:new', 'data': _serialize_message(message, current_user.username)}
    recipient_ids = _room_member_ids(db, message.room_id)
    await ws_manager.broadcast_users(recipient_ids, payload)

    offline_ids = [user_id for user_id in recipient_ids if user_id != current_user.id]
    if offline_ids:
        push_tokens = db.scalars(
            select(DevicePushToken).where(
                DevicePushToken.user_id.in_(offline_ids),
                DevicePushToken.is_active.is_(True),
            )
        ).all()
        asyncio.create_task(push_service.send_to_tokens(
            [row.token for row in push_tokens],
            {
                'event': 'message:new',
                'title': f'New message from @{current_user.username}',
                'body': message.text[:160] if message.text else 'You received a new message.',
                'tag': f'chatika-message-{message.room_id}',
                'url': '/',
                'room_id': message.room_id,
                'sender_id': message.sender_id,
                'preview': message.text[:160] if message.text else 'New encrypted message',
            },
        ))

    return MessageOut(
        id=message.id,
        room_id=message.room_id,
        sender_id=message.sender_id,
        sender_username=current_user.username,
        message_type=message.message_type,
        is_encrypted=message.is_encrypted,
        sender_key_id=message.sender_key_id,
        encrypted_body=message.encrypted_body,
        reaction_users=_parse_reactions(message),
        text=message.text,
        media_url=message.media_url,
        created_at=message.created_at,
    )


@router.get('/rooms/{room_id}/messages', response_model=list[MessageOut])
def list_messages(
    room_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MessageOut]:
    membership = db.scalar(
        select(ChatRoomMember).where(ChatRoomMember.room_id == room_id, ChatRoomMember.user_id == current_user.id)
    )
    if not membership:
        raise HTTPException(status_code=403, detail='Not a member of this room')

    safe_limit = max(1, min(limit, 100))
    messages = db.scalars(
        select(Message).where(Message.room_id == room_id).order_by(Message.created_at.desc()).limit(safe_limit)
    ).all()
    sender_ids = {message.sender_id for message in messages}
    sender_usernames = {
        user.id: user.username
        for user in db.scalars(select(User).where(User.id.in_(sender_ids))).all()
    } if sender_ids else {}
    return [
        MessageOut(
            id=m.id,
            room_id=m.room_id,
            sender_id=m.sender_id,
            sender_username=sender_usernames.get(m.sender_id),
            message_type=m.message_type,
            is_encrypted=m.is_encrypted,
            sender_key_id=m.sender_key_id,
            encrypted_body=m.encrypted_body,
            reaction_users=_parse_reactions(m),
            text=m.text,
            media_url=m.media_url,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.post('/messages/{message_id}/react', response_model=MessageOut)
async def react_to_message(
    message_id: str,
    data: MessageReactionInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    membership = db.scalar(
        select(ChatRoomMember).where(
            ChatRoomMember.room_id == data.room_id,
            ChatRoomMember.user_id == current_user.id,
        )
    )
    if not membership:
        raise HTTPException(status_code=403, detail='Not a member of this room')

    message = db.get(Message, message_id)
    if not message or message.room_id != data.room_id:
        raise HTTPException(status_code=404, detail='Message not found in this room')
    sender = db.get(User, message.sender_id)

    reactions = _parse_reactions(message)
    emoji = data.emoji.strip()
    users_for_emoji = reactions.get(emoji, [])
    if current_user.id in users_for_emoji:
        users_for_emoji = [uid for uid in users_for_emoji if uid != current_user.id]
    else:
        users_for_emoji.append(current_user.id)

    if users_for_emoji:
        reactions[emoji] = users_for_emoji
    else:
        reactions.pop(emoji, None)

    message.reaction_users_json = json.dumps(reactions, separators=(',', ':'))
    db.add(message)
    db.commit()
    db.refresh(message)

    recipient_ids = _room_member_ids(db, data.room_id)
    await ws_manager.broadcast_users(
        recipient_ids,
        {
            'event': 'message:reaction',
            'data': {
                'message_id': message.id,
                'room_id': data.room_id,
                'reaction_users': _parse_reactions(message),
            },
        },
    )

    return MessageOut(
        id=message.id,
        room_id=message.room_id,
        sender_id=message.sender_id,
        sender_username=sender.username if sender else None,
        message_type=message.message_type,
        is_encrypted=message.is_encrypted,
        sender_key_id=message.sender_key_id,
        encrypted_body=message.encrypted_body,
        reaction_users=_parse_reactions(message),
        text=message.text,
        media_url=message.media_url,
        created_at=message.created_at,
    )
