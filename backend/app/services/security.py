from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# pbkdf2_sha256 avoids native bcrypt runtime issues across environments.
pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')


class TokenError(Exception):
    pass


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: str) -> str:
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    payload = {'sub': user_id, 'exp': expire_at, 'type': 'access'}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> tuple[str, datetime]:
    expire_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days)
    payload = {'sub': user_id, 'exp': expire_at, 'type': 'refresh'}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expire_at


def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise TokenError('Invalid token') from exc

    token_type = payload.get('type')
    if token_type != expected_type:
        raise TokenError('Unexpected token type')

    if not payload.get('sub'):
        raise TokenError('Missing token subject')

    return payload
