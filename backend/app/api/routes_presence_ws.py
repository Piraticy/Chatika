from datetime import datetime, timezone

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.entities import ChatRoomMember, User
from app.services.security import TokenError, decode_token
from app.services.ws_manager import ws_manager

router = APIRouter(prefix='/realtime', tags=['realtime'])


def _user_room_mates(db: Session, user_id: str) -> list[str]:
    memberships = db.scalars(select(ChatRoomMember).where(ChatRoomMember.user_id == user_id)).all()
    room_ids = [m.room_id for m in memberships]
    if not room_ids:
        return []

    all_members = db.scalars(select(ChatRoomMember).where(ChatRoomMember.room_id.in_(room_ids))).all()
    return list({m.user_id for m in all_members if m.user_id != user_id})


def _room_member_ids(db: Session, room_id: str) -> list[str]:
    members = db.scalars(select(ChatRoomMember).where(ChatRoomMember.room_id == room_id)).all()
    return [m.user_id for m in members]


async def _broadcast_presence(db: Session, user: User) -> None:
    payload = {
        'event': 'presence:update',
        'data': {
            'user_id': user.id,
            'is_online': user.is_online,
            'last_seen_at': user.last_seen_at.isoformat() if user.last_seen_at else None,
        },
    }
    await ws_manager.broadcast_users(_user_room_mates(db, user.id), payload)


@router.websocket('/ws')
async def ws_endpoint(websocket: WebSocket) -> None:
    token = websocket.query_params.get('token', '')
    try:
        payload = decode_token(token, expected_type='access')
    except TokenError:
        await websocket.close(code=1008, reason='Invalid token')
        return

    db = SessionLocal()
    user = db.get(User, payload['sub'])
    if not user or not user.is_approved:
        db.close()
        await websocket.close(code=1008, reason='Unauthorized user')
        return

    await ws_manager.connect(user.id, websocket)

    try:
        user.is_online = True
        user.last_seen_at = None
        db.add(user)
        db.commit()
        await _broadcast_presence(db, user)

        while True:
            incoming = await websocket.receive_json()
            event = incoming.get('event')

            if event == 'call:signal':
                target_user_id = incoming.get('target_user_id')
                data = incoming.get('data', {})
                room_id = incoming.get('room_id')
                if room_id:
                    membership = db.scalar(
                        select(ChatRoomMember).where(
                            ChatRoomMember.room_id == room_id,
                            ChatRoomMember.user_id == user.id,
                        )
                    )
                    if membership:
                        targets = [uid for uid in _room_member_ids(db, room_id) if uid != user.id]
                        if target_user_id:
                            targets = [uid for uid in targets if uid == target_user_id]
                        await ws_manager.broadcast_users(
                            targets,
                            {
                                'event': 'call:signal',
                                'from_user_id': user.id,
                                'room_id': room_id,
                                'data': data,
                            },
                        )
                elif target_user_id:
                    await ws_manager.send_user(
                        target_user_id,
                        {
                            'event': 'call:signal',
                            'from_user_id': user.id,
                            'data': data,
                        },
                    )
            elif event == 'typing:update':
                room_id = incoming.get('room_id')
                is_typing = bool(incoming.get('is_typing', False))
                if room_id:
                    membership = db.scalar(
                        select(ChatRoomMember).where(
                            ChatRoomMember.room_id == room_id,
                            ChatRoomMember.user_id == user.id,
                        )
                    )
                    if membership:
                        targets = [uid for uid in _room_member_ids(db, room_id) if uid != user.id]
                        await ws_manager.broadcast_users(
                            targets,
                            {
                                'event': 'typing:update',
                                'data': {
                                    'room_id': room_id,
                                    'user_id': user.id,
                                    'is_typing': is_typing,
                                },
                            },
                        )
            elif event == 'ping':
                await websocket.send_json({'event': 'pong'})
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(user.id, websocket)
        user.is_online = False
        user.last_seen_at = datetime.now(timezone.utc)
        db.add(user)
        db.commit()
        await _broadcast_presence(db, user)
        db.close()
