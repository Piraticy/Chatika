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

        expo_tokens = [token for token in tokens if token.startswith('ExponentPushToken[')]
        web_tokens = [token for token in tokens if token not in expo_tokens]

        if settings.push_provider in {'expo', 'multi'} and expo_tokens:
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

        if settings.push_provider not in {'webpush', 'multi'} or not settings.vapid_private_key or not settings.vapid_claims_email:
            return

        async def send_one(token: str) -> None:
            try:
                await asyncio.to_thread(
                    webpush,
                    subscription_info=json.loads(token),
                    data=json.dumps(payload),
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={'sub': settings.vapid_claims_email},
                )
            except Exception:
                return

        await asyncio.gather(*(send_one(token) for token in web_tokens))


push_service = PushService()
