from typing import Any, Dict, List

import httpx

from app.core.config import settings


class PushService:
    async def send_to_tokens(self, tokens: List[str], payload: Dict[str, Any]) -> None:
        if not tokens:
            return

        # This scaffold uses a provider-agnostic webhook bridge so you can wire
        # FCM/APNs/WebPush in your preferred worker without coupling API runtime.
        if settings.push_provider == 'webhook' and settings.push_webhook_url:
            async with httpx.AsyncClient(timeout=settings.push_request_timeout_seconds) as client:
                await client.post(
                    settings.push_webhook_url,
                    json={
                        'tokens': tokens,
                        'payload': payload,
                    },
                )


push_service = PushService()
