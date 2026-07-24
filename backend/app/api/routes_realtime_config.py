import httpx
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.entities import User
from app.schemas.realtime import IceConfigOut

router = APIRouter(prefix='/realtime', tags=['realtime'])

CLOUDFLARE_TURN_TIMEOUT_SECONDS = 5.0


async def _cloudflare_turn_servers() -> list[dict]:
    if not settings.cloudflare_turn_key_id or not settings.cloudflare_turn_api_token:
        return []
    try:
        async with httpx.AsyncClient(timeout=CLOUDFLARE_TURN_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f'https://rtc.live.cloudflare.com/v1/turn/keys/{settings.cloudflare_turn_key_id}/credentials/generate',
                headers={'Authorization': f'Bearer {settings.cloudflare_turn_api_token}'},
                json={'ttl': settings.cloudflare_turn_ttl_seconds},
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError):
        # Short-lived credentials are a nice-to-have, not a hard dependency - if
        # Cloudflare is unreachable or misconfigured, calls still get the static
        # STUN-only fallback below rather than a broken ice-config response.
        return []

    ice_servers = payload.get('iceServers')
    if isinstance(ice_servers, dict):
        ice_servers = [ice_servers]
    if not isinstance(ice_servers, list):
        return []
    return [entry for entry in ice_servers if isinstance(entry, dict) and entry.get('urls')]


@router.get('/ice-config', response_model=IceConfigOut)
async def ice_config(_current_user: User = Depends(get_current_user)) -> IceConfigOut:
    turn_servers = await _cloudflare_turn_servers()
    return IceConfigOut(force_turn=settings.force_turn, ice_servers=[*settings.ice_servers, *turn_servers])


@router.get('/push-config')
def push_config(_current_user: User = Depends(get_current_user)) -> dict:
    return {'vapid_public_key': settings.vapid_public_key}
