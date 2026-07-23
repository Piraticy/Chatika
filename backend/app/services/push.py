import asyncio
import json
from typing import Any, Dict, List

import httpx
from pywebpush import webpush

from app.core.config import settings


class PushService:
    async def send_to_tokens(self, tokens: List[str], payload: Dict[str, Any]) -> None:
        if not tokens:
            return

        if settings.push_provider == 'webhook' and settings.push_webhook_url:
            try:
                async with httpx.AsyncClient(timeout=settings.push_request_timeout_seconds) as client:
                    await client.post(
                        settings.push_webhook_url,
                        json={
                            'tokens': tokens,
                            'payload': payload,
                        },
                    )
            except httpx.HTTPError:
                return
            return

        # Auto-detect by token shape/available keys rather than requiring an extra
        # PUSH_PROVIDER switch to be kept in sync - a token that looks like an Expo
        # token goes to Expo, everything else goes to web push if VAPID keys exist.
        # push_provider is only consulted above for the explicit 'webhook' override.
        expo_tokens = [token for token in tokens if token.startswith('ExponentPushToken[')]
        web_tokens = [token for token in tokens if token not in expo_tokens]

        if expo_tokens:
            expo_payload = [
                {
                    'to': token,
                    'title': payload.get('title', 'Chatika'),
                    'body': payload.get('body') or payload.get('preview') or 'You have a new Chatika update.',
                    'sound': 'default',
                    'data': payload,
                }
                for token in expo_tokens
            ]
            try:
                async with httpx.AsyncClient(timeout=settings.push_request_timeout_seconds) as client:
                    await client.post('https://exp.host/--/api/v2/push/send', json=expo_payload)
            except httpx.HTTPError:
                pass

        if not web_tokens or not settings.vapid_private_key or not settings.vapid_claims_email:
            return

        # The VAPID spec requires 'sub' to be a mailto: URI or https URL - a bare
        # address (the natural thing to put in an env var) gets silently rejected
        # by some push services otherwise.
        claims_email = settings.vapid_claims_email
        sub = claims_email if claims_email.startswith(('mailto:', 'http://', 'https://')) else f'mailto:{claims_email}'

        async def send_one(token: str) -> None:
            try:
                await asyncio.to_thread(
                    webpush,
                    subscription_info=json.loads(token),
                    data=json.dumps(payload),
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={'sub': sub},
                )
            except Exception:
                return

        await asyncio.gather(*(send_one(token) for token in web_tokens))


push_service = PushService()
