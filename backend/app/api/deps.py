from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import SessionToken, User
from app.services.security import TokenError, decode_token

ADMIN_USERNAME = 'piraticy'


def is_designated_admin(user: User) -> bool:
    return user.is_admin and user.username.casefold() == ADMIN_USERNAME


def _bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing Authorization header')
    parts = authorization.split(' ')
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid auth scheme')
    return parts[1]


def get_current_user(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
) -> User:
    token = _bearer_token(authorization)
    try:
        payload = decode_token(token, expected_type='access')
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    user = db.get(User, payload['sub'])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found')
    if not user.is_approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Account pending admin approval')
    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not is_designated_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Admin role required')
    return current_user


def validate_refresh_session(db: Session, refresh_token: str) -> SessionToken:
    try:
        payload = decode_token(refresh_token, expected_type='refresh')
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    stmt = select(SessionToken).where(SessionToken.user_id == payload['sub'])
    sessions = db.scalars(stmt).all()
    now = datetime.now(timezone.utc)
    for session in sessions:
        from app.services.security import verify_password

        if verify_password(refresh_token, session.refresh_token_hash):
            expires_at = session.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if session.revoked_at is not None or expires_at < now:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Refresh session expired or revoked')
            return session

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Refresh session not found')
