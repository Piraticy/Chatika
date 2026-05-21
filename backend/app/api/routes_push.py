from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import DevicePushToken, User
from app.schemas.push import PushTokenRegisterInput, PushTokenUnregisterInput

router = APIRouter(prefix='/push', tags=['push'])


@router.post('/register-token')
def register_token(
    data: PushTokenRegisterInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    existing = db.scalar(
        select(DevicePushToken).where(
            DevicePushToken.user_id == current_user.id,
            DevicePushToken.platform == data.platform,
            DevicePushToken.token == data.token,
        )
    )

    if not existing:
        existing = DevicePushToken(
            user_id=current_user.id,
            platform=data.platform,
            token=data.token,
            device_name=data.device_name,
            is_active=True,
        )
    else:
        existing.device_name = data.device_name
        existing.is_active = True

    db.add(existing)
    db.commit()
    return {'message': 'Push token registered'}


@router.post('/unregister-token')
def unregister_token(
    data: PushTokenUnregisterInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    token = db.scalar(
        select(DevicePushToken).where(
            DevicePushToken.user_id == current_user.id,
            DevicePushToken.platform == data.platform,
            DevicePushToken.token == data.token,
        )
    )
    if token:
        token.is_active = False
        db.add(token)
        db.commit()

    return {'message': 'Push token unregistered'}
