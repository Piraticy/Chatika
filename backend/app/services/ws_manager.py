import asyncio
from collections import defaultdict
import contextlib
import json
from typing import Any, Optional

from fastapi import WebSocket
from redis import asyncio as redis_async

from app.core.config import settings


class WSManager:
    def __init__(self) -> None:
        self._user_connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._redis: Optional[redis_async.Redis] = None
        self._pubsub = None
        self._listener_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        if not settings.redis_url or self._running:
            return
        self._running = True
        self._redis = redis_async.from_url(settings.redis_url, decode_responses=True)
        self._pubsub = self._redis.pubsub(ignore_subscribe_messages=True)
        await self._pubsub.psubscribe(f'{settings.redis_channel_prefix}*')
        self._listener_task = asyncio.create_task(self._listen_pubsub())

    async def stop(self) -> None:
        self._running = False
        if self._listener_task:
            self._listener_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._listener_task
            self._listener_task = None
        if self._pubsub:
            await self._pubsub.close()
            self._pubsub = None
        if self._redis:
            await self._redis.aclose()
            self._redis = None

    async def _listen_pubsub(self) -> None:
        if not self._pubsub:
            return

        while self._running:
            message = await self._pubsub.get_message(timeout=1.0)
            if not message or message.get('type') != 'pmessage':
                continue
            channel = str(message.get('channel', ''))
            raw_data = message.get('data')
            if not channel or not raw_data:
                continue

            user_id = channel.replace(settings.redis_channel_prefix, '', 1)
            try:
                envelope = json.loads(raw_data)
            except (TypeError, json.JSONDecodeError):
                continue
            if envelope.get('origin') == settings.app_instance_id:
                continue

            payload = envelope.get('payload')
            if isinstance(payload, dict):
                await self._send_local(user_id, payload)

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._user_connections[user_id].add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        if user_id in self._user_connections:
            self._user_connections[user_id].discard(websocket)
            if not self._user_connections[user_id]:
                self._user_connections.pop(user_id, None)

    def has_connections(self, user_id: str) -> bool:
        return bool(self._user_connections.get(user_id))

    async def _send_local(self, user_id: str, payload: dict[str, Any]) -> None:
        connections = tuple(self._user_connections.get(user_id, set()))
        if not connections:
            return
        results = await asyncio.gather(
            *(websocket.send_json(payload) for websocket in connections),
            return_exceptions=True,
        )
        stale_connections = [
            websocket
            for websocket, result in zip(connections, results)
            if isinstance(result, Exception)
        ]
        for ws in stale_connections:
            self.disconnect(user_id, ws)

    async def send_user(self, user_id: str, payload: dict[str, Any]) -> None:
        await self._send_local(user_id, payload)
        if self._redis:
            channel = f'{settings.redis_channel_prefix}{user_id}'
            envelope = {'origin': settings.app_instance_id, 'payload': payload}
            await self._redis.publish(channel, json.dumps(envelope))

    async def broadcast_users(self, user_ids: list[str], payload: dict) -> None:
        unique_user_ids = list(dict.fromkeys(user_ids))
        await asyncio.gather(
            *(self.send_user(user_id, payload) for user_id in unique_user_ids),
            return_exceptions=True,
        )


ws_manager = WSManager()
