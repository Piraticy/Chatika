from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import ADMIN_USERNAME, get_current_user, is_designated_admin, validate_refresh_session
from app.db.session import get_db
from app.models.entities import BetaFeedback, SessionToken, User
from app.schemas.auth import ForgotPasswordInput, LoginInput, LogoutInput, ProfileUpdateInput, RefreshInput, RegisterInput, TokenPair, UserMe
from app.services.security import create_access_token, create_refresh_token, hash_password, verify_password

router = APIRouter(prefix='/auth', tags=['auth'])

COUNTRY_HEADERS = (
    'cf-ipcountry',
    'cloudfront-viewer-country',
    'x-vercel-ip-country',
    'x-country-code',
)


def _clean_optional(value: str | None, max_length: int) -> str | None:
    cleaned = value.strip()[:max_length] if value else ''
    return cleaned or None


def _country_code(request: Request, locale: str | None) -> str | None:
    for header in COUNTRY_HEADERS:
        value = request.headers.get(header, '').strip().upper()
        if len(value) == 2 and value.isalpha() and value not in {'XX', 'T1'}:
            return value

    if locale:
        parts = locale.replace('_', '-').split('-')
        for part in reversed(parts[1:]):
            if len(part) == 2 and part.isalpha():
                return part.upper()
    return None


def _apply_client_context(user: User, data: RegisterInput | LoginInput, request: Request, *, signup: bool) -> None:
    device = _clean_optional(data.device_name, 120)
    locale = _clean_optional(data.locale, 35)
    client_timezone = _clean_optional(data.timezone, 80)
    country = _country_code(request, locale)

    user.last_device = device
    user.last_locale = locale
    user.last_timezone = client_timezone
    user.last_country_code = country
    if signup:
        user.signup_device = device
        user.signup_locale = locale
        user.signup_timezone = client_timezone
        user.signup_country_code = country


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
def register(data: RegisterInput, request: Request, db: Session = Depends(get_db)) -> TokenPair:
    existing_filters = [User.username == data.username]
    if data.phone_number:
        existing_filters.append(User.phone_number == data.phone_number)
    existing = db.scalar(select(User).where(or_(*existing_filters)))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Username already exists')

    user = User(
        username=data.username,
        phone_number=data.phone_number,
        password_hash=hash_password(data.password),
        is_admin=data.username.casefold() == ADMIN_USERNAME,
        is_approved=True,
        beta_feedback_eligible=True,
    )
    _apply_client_context(user, data, request, signup=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    return _token_pair(db, user, data.device_name)


@router.post('/login', response_model=TokenPair)
def login(data: LoginInput, request: Request, db: Session = Depends(get_db)) -> TokenPair:
    user = db.scalar(select(User).where(User.username == data.username))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')
    if not user.is_approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Account pending admin approval')
    _apply_client_context(user, data, request, signup=False)
    db.add(user)
    db.commit()
    return _token_pair(db, user, data.device_name)


@router.post('/forgot-password')
def forgot_password(data: ForgotPasswordInput, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(User.username == data.username))
    if user:
        user.password_reset_requested_at = datetime.now(timezone.utc)
        db.add(user)
        db.commit()
    # Same response whether or not the username exists, so this can't be used to
    # probe which usernames are registered.
    return {'message': 'If that account exists, an admin has been notified and will help reset the password.'}


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
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserMe:
    has_feedback = False
    if current_user.beta_feedback_eligible:
        has_feedback = db.scalar(select(BetaFeedback.id).where(BetaFeedback.user_id == current_user.id)) is not None
    return UserMe(
        id=current_user.id,
        username=current_user.username,
        phone_number=current_user.phone_number,
        avatar_url=current_user.avatar_url,
        is_admin=is_designated_admin(current_user),
        is_approved=current_user.is_approved,
        is_online=current_user.is_online,
        last_seen_at=current_user.last_seen_at,
        needs_beta_feedback=current_user.beta_feedback_eligible and not has_feedback,
    )


@router.patch('/profile', response_model=UserMe)
def update_profile(
    data: ProfileUpdateInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserMe:
    if data.avatar_url and not data.avatar_url.startswith(f'/api/v1/media/files/{current_user.id}/'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Profile image must be uploaded by this account')

    current_user.avatar_url = data.avatar_url
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return me(current_user, db)
