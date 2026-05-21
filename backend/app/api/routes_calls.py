from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import CallParticipant, CallRoom, User
from app.schemas.call import CallRoomOut, JoinCallInput, StartCallInput
from app.services.ws_manager import ws_manager

router = APIRouter(prefix='/calls', tags=['calls'])


@router.post('/start', response_model=CallRoomOut)
async def start_call(data: StartCallInput, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CallRoomOut:
    room = CallRoom(chat_room_id=data.chat_room_id, created_by=current_user.id)
    db.add(room)
    db.commit()
    db.refresh(room)

    db.add(CallParticipant(call_room_id=room.id, user_id=current_user.id))
    for participant_id in set(data.participant_ids):
        if participant_id != current_user.id:
            db.add(CallParticipant(call_room_id=room.id, user_id=participant_id))
            await ws_manager.send_user(
                participant_id,
                {
                    'event': 'call:invited',
                    'data': {
                        'call_room_id': room.id,
                        'from_user_id': current_user.id,
                    },
                },
            )
    db.commit()

    return CallRoomOut(id=room.id, chat_room_id=room.chat_room_id, created_by=room.created_by, ended_at=room.ended_at)


@router.post('/join', response_model=CallRoomOut)
def join_call(data: JoinCallInput, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CallRoomOut:
    room = db.get(CallRoom, data.call_room_id)
    if not room or room.ended_at is not None:
        raise HTTPException(status_code=404, detail='Call room not available')

    participant = db.scalar(
        select(CallParticipant).where(
            and_(
                CallParticipant.call_room_id == room.id,
                CallParticipant.user_id == current_user.id,
            )
        )
    )
    if not participant:
        participant = CallParticipant(call_room_id=room.id, user_id=current_user.id)
        db.add(participant)
        db.commit()

    return CallRoomOut(id=room.id, chat_room_id=room.chat_room_id, created_by=room.created_by, ended_at=room.ended_at)


@router.post('/end/{call_room_id}')
def end_call(call_room_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    room = db.get(CallRoom, call_room_id)
    if not room:
        raise HTTPException(status_code=404, detail='Call room not found')
    if room.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail='Only the owner/admin can end this call')

    room.ended_at = datetime.now(timezone.utc)
    db.add(room)
    db.commit()
    return {'message': 'Call ended'}
