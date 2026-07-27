from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import StatusUpdate, User
from app.schemas.status import StatusCreateInput, StatusOut
from app.services.ws_manager import ws_manager

router = APIRouter(prefix='/status', tags=['status'])

OFFICIAL_STATUS_CREATED_AT = datetime(2026, 7, 27, tzinfo=timezone.utc)
OFFICIAL_STATUS_EXPIRES_AT = datetime(2036, 7, 27, tzinfo=timezone.utc)


def _serialize_status(status: StatusUpdate, user: User, viewer_id: str) -> StatusOut:
    return StatusOut(
        id=status.id,
        author_id=user.id,
        username=user.username,
        avatar_url=user.avatar_url,
        text=status.text,
        media_url=status.media_url,
        created_at=status.created_at,
        expires_at=status.expires_at,
        is_own=user.id == viewer_id,
    )


def _official_status() -> StatusOut:
    return StatusOut(
        id='chatika-official',
        author_id='chatika',
        username='Chatika',
        avatar_url='/logo.svg',
        text='Welcome to the Chatika beta. Share feedback and keep your people close.',
        created_at=OFFICIAL_STATUS_CREATED_AT,
        expires_at=OFFICIAL_STATUS_EXPIRES_AT,
        is_official=True,
    )


@router.get('', response_model=list[StatusOut])
def list_statuses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StatusOut]:
    now = datetime.now(timezone.utc)
    rows = db.execute(
        select(StatusUpdate, User)
        .join(User, User.id == StatusUpdate.user_id)
        .where(StatusUpdate.expires_at > now, User.is_approved.is_(True))
        .order_by(StatusUpdate.created_at.desc())
        .limit(100)
    ).all()
    return [_official_status(), *[_serialize_status(status, user, current_user.id) for status, user in rows]]


@router.post('', response_model=StatusOut)
async def create_status(
    data: StatusCreateInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StatusOut:
    text = data.text.strip() if data.text else None
    media_url = data.media_url.strip() if data.media_url else None
    if not text and not media_url:
        raise HTTPException(status_code=400, detail='A status needs text or media')

    now = datetime.now(timezone.utc)
    db.execute(delete(StatusUpdate).where(StatusUpdate.user_id == current_user.id))
    status = StatusUpdate(
        user_id=current_user.id,
        text=text,
        media_url=media_url,
        expires_at=now + timedelta(hours=24),
    )
    db.add(status)
    db.commit()
    db.refresh(status)

    output = _serialize_status(status, current_user, current_user.id)
    recipient_ids = db.scalars(select(User.id).where(User.is_approved.is_(True))).all()
    payload = {'event': 'status:new', 'data': output.model_dump(mode='json')}
    await ws_manager.broadcast_users(recipient_ids, payload)
    return output
