from typing import Any, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'Chatika API'
    api_prefix: str = '/api/v1'
    app_instance_id: str = 'chatika-instance-local'

    database_url: str = 'sqlite:///./chatika.db'
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    auto_create_schema: bool = True
    jwt_secret: str = 'change-me-in-production'
    jwt_algorithm: str = 'HS256'
    access_token_minutes: int = 30
    refresh_token_days: int = 365

    redis_url: Optional[str] = None
    redis_channel_prefix: str = 'chatika:ws:user:'

    backup_encryption_key: str = 'change-me-with-32-byte-base64-fernet-key'
    media_root: str = './media'
    media_max_bytes: int = 25 * 1024 * 1024
    message_max_length: int = 4000

    push_provider: str = 'none'
    push_webhook_url: Optional[str] = None
    push_request_timeout_seconds: float = 5.0
    vapid_public_key: Optional[str] = None
    vapid_private_key: Optional[str] = None
    vapid_claims_email: Optional[str] = None

    force_turn: bool = False
    # STUN alone fails whenever either side is behind a restrictive/carrier-grade
    # NAT (common on mobile networks) since there's no relay fallback. A previous
    # attempt hardcoded the "Open Relay" free TURN demo credentials here, but a
    # live STUN probe against it timed out on every port - that service is dead,
    # so it's been removed rather than ship an entry that silently does nothing.
    # See cloudflare_turn_key_id/cloudflare_turn_api_token below for a real,
    # verified-live TURN option, or override this list entirely via ICE_SERVERS.
    ice_servers: list[dict[str, Any]] = Field(
        default_factory=lambda: [
            {'urls': ['stun:stun.l.google.com:19302']},
        ]
    )

    # Cloudflare Realtime TURN (https://developers.cloudflare.com/realtime/turn/):
    # has a real free tier and is actively maintained. When both are set, ice-config
    # mints short-lived TURN credentials from Cloudflare's API on every request and
    # merges them with the static ice_servers above. Leave unset to skip entirely.
    cloudflare_turn_key_id: Optional[str] = None
    cloudflare_turn_api_token: Optional[str] = None
    cloudflare_turn_ttl_seconds: int = 86400

    @property
    def sqlalchemy_database_url(self) -> str:
        url = self.database_url.strip()
        if url.startswith('postgresql://'):
            return url.replace('postgresql://', 'postgresql+psycopg://', 1)
        if url.startswith('postgres://'):
            return url.replace('postgres://', 'postgresql+psycopg://', 1)
        return url


settings = Settings()
