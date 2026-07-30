from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, is_designated_admin
from app.db.session import get_db
from app.models.entities import StatusUpdate, StatusView, User
from app.schemas.status import StatusCreateInput, StatusOut, StatusViewerOut
from app.services.ws_manager import ws_manager

router = APIRouter(prefix='/status', tags=['status'])

OFFICIAL_STATUS_CREATED_AT = datetime(2026, 7, 27, tzinfo=timezone.utc)
OFFICIAL_STATUS_EXPIRES_AT = datetime(2036, 7, 27, tzinfo=timezone.utc)


def _serialize_status(status: StatusUpdate, user: User, viewer_id: str) -> StatusOut:
    # The designated admin posts under the Chatika brand, not their personal
    # username - the row still belongs to their real user_id, only the
    # displayed identity changes so it reads as an official broadcast.
    official = is_designated_admin(user)
    return StatusOut(
        id=status.id,
        author_id=user.id,
        username='Chatika' if official else user.username,
        avatar_url='/logo.svg' if official else user.avatar_url,
        text=status.text,
        media_url=status.media_url,
        created_at=status.created_at,
        expires_at=status.expires_at,
        is_official=official,
        is_own=user.id == viewer_id,
    )


def _status_view_stats(db: Session, status_id: str) -> tuple[int, list[StatusViewerOut]]:
    rows = db.execute(
        select(StatusView, User)
        .join(User, User.id == StatusView.viewer_id)
        .where(StatusView.status_id == status_id)
        .order_by(StatusView.created_at.desc())
    ).all()
    viewers = [
        StatusViewerOut(id=user.id, username=user.username, avatar_url=user.avatar_url, viewed_at=view.created_at)
        for view, user in rows
    ]
    return len(viewers), viewers


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
    serialized = []
    # View counts/viewer lists are only attached for the status's own author
    # (or the admin, for community oversight) - other viewers never see who
    # else viewed a status, matching the usual status/story privacy model.
    can_see_any_views = is_designated_admin(current_user)
    for status, user in rows:
        output = _serialize_status(status, user, current_user.id)
        if output.is_own or can_see_any_views:
            view_count, viewers = _status_view_stats(db, status.id)
            output.view_count = view_count
            output.viewers = viewers
        serialized.append(output)
    # Only fall back to the hardcoded welcome tile when the admin hasn't
    # posted a real official status - a genuine post always takes its place.
    has_real_official = any(item.is_official for item in serialized)
    prefix = [] if has_real_official else [_official_status()]
    return [*prefix, *serialized]


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


@router.post('/{status_id}/view', status_code=204)
def record_status_view(
    status_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    status = db.get(StatusUpdate, status_id)
    if not status:
        raise HTTPException(status_code=404, detail='Status not found')
    if status.user_id == current_user.id:
        return
    existing = db.execute(
        select(StatusView).where(StatusView.status_id == status_id, StatusView.viewer_id == current_user.id)
    ).scalar_one_or_none()
    if existing:
        return
    db.add(StatusView(status_id=status_id, viewer_id=current_user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


@router.delete('/{status_id}', status_code=204)
async def delete_status(
    status_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    status = db.get(StatusUpdate, status_id)
    if not status or status.user_id != current_user.id:
        raise HTTPException(status_code=404, detail='Status not found')
    db.delete(status)
    db.commit()

    recipient_ids = db.scalars(select(User.id).where(User.is_approved.is_(True))).all()
    payload = {'event': 'status:removed', 'data': {'id': status_id, 'author_id': current_user.id}}
    await ws_manager.broadcast_users(recipient_ids, payload)
