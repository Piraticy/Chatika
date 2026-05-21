from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import ChatRoom, ChatRoomMember, DevicePushToken, Message, User
from app.schemas.chat import CreateRoomInput, MessageOut, RoomOut, SendMessageInput
from app.services.push import push_service
from app.services.ws_manager import ws_manager

router = APIRouter(prefix='/chat', tags=['chat'])


def _room_member_ids(db: Session, room_id: str) -> list[str]:
    members = db.scalars(select(ChatRoomMember).where(ChatRoomMember.room_id == room_id)).all()
    return [m.user_id for m in members]


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

    return RoomOut(id=room.id, name=room.name, is_group=room.is_group, created_by=room.created_by)


@router.get('/rooms', response_model=list[RoomOut])
def list_rooms(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[RoomOut]:
    memberships = db.scalars(select(ChatRoomMember).where(ChatRoomMember.user_id == current_user.id)).all()
    room_ids = [m.room_id for m in memberships]
    if not room_ids:
        return []
    rooms = db.scalars(select(ChatRoom).where(ChatRoom.id.in_(room_ids))).all()
    return [RoomOut(id=r.id, name=r.name, is_group=r.is_group, created_by=r.created_by) for r in rooms]


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

    payload = {
        'event': 'message:new',
        'data': {
            'id': message.id,
            'room_id': message.room_id,
            'sender_id': message.sender_id,
            'message_type': message.message_type,
            'is_encrypted': message.is_encrypted,
            'sender_key_id': message.sender_key_id,
            'encrypted_body': message.encrypted_body,
            'text': message.text,
            'media_url': message.media_url,
            'created_at': message.created_at.isoformat(),
        },
    }
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
        await push_service.send_to_tokens(
            [row.token for row in push_tokens],
            {
                'event': 'message:new',
                'room_id': message.room_id,
                'sender_id': message.sender_id,
                'preview': message.text[:160] if message.text else 'New encrypted message',
            },
        )

    return MessageOut(
        id=message.id,
        room_id=message.room_id,
        sender_id=message.sender_id,
        message_type=message.message_type,
        is_encrypted=message.is_encrypted,
        sender_key_id=message.sender_key_id,
        encrypted_body=message.encrypted_body,
        text=message.text,
        media_url=message.media_url,
        created_at=message.created_at,
    )


@router.get('/rooms/{room_id}/messages', response_model=list[MessageOut])
def list_messages(room_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[MessageOut]:
    membership = db.scalar(
        select(ChatRoomMember).where(ChatRoomMember.room_id == room_id, ChatRoomMember.user_id == current_user.id)
    )
    if not membership:
        raise HTTPException(status_code=403, detail='Not a member of this room')

    messages = db.scalars(select(Message).where(Message.room_id == room_id).order_by(Message.created_at.desc()).limit(100)).all()
    return [
        MessageOut(
            id=m.id,
            room_id=m.room_id,
            sender_id=m.sender_id,
            message_type=m.message_type,
            is_encrypted=m.is_encrypted,
            sender_key_id=m.sender_key_id,
            encrypted_body=m.encrypted_body,
            text=m.text,
            media_url=m.media_url,
            created_at=m.created_at,
        )
        for m in messages
    ]
