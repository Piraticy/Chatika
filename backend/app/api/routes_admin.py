from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.entities import BetaFeedback, User
from app.schemas.admin import AddUserInput, ApproveUserInput, RemoveUserInput
from app.services.security import hash_password

router = APIRouter(prefix='/admin', tags=['admin'])


@router.get('/pending-users')
def pending_users(_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> list[dict]:
    users = db.scalars(select(User).where(User.is_approved.is_(False))).all()
    return [{'id': u.id, 'username': u.username, 'phone_number': u.phone_number} for u in users]


@router.get('/users')
def list_users(_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> list[dict]:
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    return [
        {
            'id': user.id,
            'username': user.username,
            'avatar_url': user.avatar_url,
            'is_admin': user.is_admin,
            'is_approved': user.is_approved,
            'is_online': user.is_online,
            'last_seen_at': user.last_seen_at.isoformat() if user.last_seen_at else None,
            'created_at': user.created_at.isoformat() if user.created_at else None,
            'country_code': user.last_country_code or user.signup_country_code,
            'signup_country_code': user.signup_country_code,
            'locale': user.last_locale or user.signup_locale,
            'timezone': user.last_timezone or user.signup_timezone,
            'device': user.last_device or user.signup_device,
            'signup_device': user.signup_device,
        }
        for user in users
    ]


@router.get('/feedback')
def list_feedback(_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(
        select(BetaFeedback, User.username)
        .join(User, User.id == BetaFeedback.user_id)
        .order_by(BetaFeedback.created_at.desc())
    ).all()
    return [
        {
            'id': feedback.id,
            'username': username,
            'rating': feedback.rating,
            'favorite_feature': feedback.favorite_feature,
            'improvement_area': feedback.improvement_area,
            'comment': feedback.comment,
            'app_version': feedback.app_version,
            'platform': feedback.platform,
            'created_at': feedback.created_at.isoformat() if feedback.created_at else None,
        }
        for feedback, username in rows
    ]


@router.post('/approve-user')
def approve_user(data: ApproveUserInput, _admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> dict:
    user = db.get(User, data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    user.is_approved = True
    db.add(user)
    db.commit()
    return {'message': 'User approved'}


@router.post('/remove-user')
def remove_user(data: RemoveUserInput, _admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> dict:
    user = db.get(User, data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    db.delete(user)
    db.commit()
    return {'message': 'User removed'}


@router.post('/add-user')
def add_user(data: AddUserInput, _admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> dict:
    existing_filters = [User.username == data.username]
    if data.phone_number:
        existing_filters.append(User.phone_number == data.phone_number)
    existing = db.scalar(select(User).where(or_(*existing_filters)))
    if existing:
        raise HTTPException(status_code=409, detail='Username already exists')

    user = User(
        username=data.username,
        phone_number=data.phone_number,
        password_hash=hash_password(data.password),
        is_approved=True,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    return {'message': 'User added', 'user_id': user.id}
