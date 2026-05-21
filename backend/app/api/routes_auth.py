from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, validate_refresh_session
from app.db.session import get_db
from app.models.entities import SessionToken, User
from app.schemas.auth import LoginInput, LogoutInput, RefreshInput, RegisterInput, TokenPair, UserMe
from app.services.security import create_access_token, create_refresh_token, hash_password, verify_password

router = APIRouter(prefix='/auth', tags=['auth'])


def _token_pair(db: Session, user: User, device_name: str) -> TokenPair:
    access = create_access_token(user.id)
    refresh, expires_at = create_refresh_token(user.id)
    session = SessionToken(
        user_id=user.id,
        refresh_token_hash=hash_password(refresh),
        device_name=device_name,
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post('/register', response_model=TokenPair)
def register(data: RegisterInput, db: Session = Depends(get_db)) -> TokenPair:
    existing = db.scalar(select(User).where((User.username == data.username) | (User.phone_number == data.phone_number)))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Username or phone number already exists')

    first_user = db.scalar(select(func.count(User.id))) == 0
    user = User(
        username=data.username,
        phone_number=data.phone_number,
        password_hash=hash_password(data.password),
        is_admin=first_user,
        is_approved=first_user,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if not user.is_approved:
        raise HTTPException(status_code=status.HTTP_202_ACCEPTED, detail='Registered. Wait for admin approval.')

    return _token_pair(db, user, data.device_name)


@router.post('/login', response_model=TokenPair)
def login(data: LoginInput, db: Session = Depends(get_db)) -> TokenPair:
    user = db.scalar(select(User).where(User.phone_number == data.phone_number))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')
    if not user.is_approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Account pending admin approval')
    return _token_pair(db, user, data.device_name)


@router.post('/refresh', response_model=TokenPair)
def refresh(data: RefreshInput, db: Session = Depends(get_db)) -> TokenPair:
    session = validate_refresh_session(db, data.refresh_token)
    user = db.get(User, session.user_id)
    if not user or not user.is_approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='User cannot refresh session')
    session.revoked_at = datetime.now(timezone.utc)
    db.add(session)
    db.commit()
    return _token_pair(db, user, session.device_name)


@router.post('/logout')
def logout(data: LogoutInput, db: Session = Depends(get_db)) -> dict:
    session = validate_refresh_session(db, data.refresh_token)
    session.revoked_at = datetime.now(timezone.utc)
    db.add(session)
    db.commit()
    return {'message': 'Logged out'}


@router.get('/me', response_model=UserMe)
def me(current_user: User = Depends(get_current_user)) -> UserMe:
    return UserMe(
        id=current_user.id,
        username=current_user.username,
        phone_number=current_user.phone_number,
        is_admin=current_user.is_admin,
        is_approved=current_user.is_approved,
        is_online=current_user.is_online,
        last_seen_at=current_user.last_seen_at,
    )
