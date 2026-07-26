import httpx
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.entities import User
from app.schemas.realtime import IceConfigOut

router = APIRouter(prefix='/realtime', tags=['realtime'])

CLOUDFLARE_TURN_TIMEOUT_SECONDS = 5.0


def _has_turn_server(ice_servers: list[dict]) -> bool:
    for server in ice_servers:
        urls = server.get('urls', [])
        if not isinstance(urls, list):
            urls = [urls]
        if any(str(url).startswith(('turn:', 'turns:')) for url in urls):
            return True
    return False


async def _cloudflare_turn_servers() -> list[dict]:
    if not settings.cloudflare_turn_key_id or not settings.cloudflare_turn_api_token:
        return []
    try:
        async with httpx.AsyncClient(timeout=CLOUDFLARE_TURN_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f'https://rtc.live.cloudflare.com/v1/turn/keys/{settings.cloudflare_turn_key_id}/credentials/generate-ice-servers',
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
    valid_servers = []
    for entry in ice_servers:
        if not isinstance(entry, dict) or not entry.get('urls'):
            continue
        urls = entry['urls'] if isinstance(entry['urls'], list) else [entry['urls']]
        filtered_urls = [url for url in urls if ':53' not in str(url)]
        if filtered_urls:
            valid_servers.append({**entry, 'urls': filtered_urls})
    return valid_servers


@router.get('/ice-config', response_model=IceConfigOut)
async def ice_config(_current_user: User = Depends(get_current_user)) -> IceConfigOut:
    turn_servers = await _cloudflare_turn_servers()
    ice_servers = [*settings.ice_servers, *turn_servers]
    return IceConfigOut(force_turn=settings.force_turn and _has_turn_server(ice_servers), ice_servers=ice_servers)


@router.get('/push-config')
def push_config(_current_user: User = Depends(get_current_user)) -> dict:
    return {'vapid_public_key': settings.vapid_public_key}
