from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes_admin import router as admin_router
from app.api.routes_auth import router as auth_router
from app.api.routes_backup import router as backup_router
from app.api.routes_calls import router as calls_router
from app.api.routes_chat import router as chat_router
from app.api.routes_health import router as health_router
from app.api.routes_keys import router as keys_router
from app.api.routes_media import router as media_router
from app.api.routes_presence_ws import router as realtime_router
from app.api.routes_push import router as push_router
from app.api.routes_realtime_config import router as realtime_config_router
from app.core.config import settings
from app.db.session import engine
from app.models.base import Base
from app.services.ws_manager import ws_manager

app = FastAPI(title=settings.app_name)
web_root = Path(__file__).resolve().parents[1] / 'web_dist'

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/', include_in_schema=False)
def root():
    index_path = web_root / 'index.html'
    if index_path.exists():
        return FileResponse(index_path)
    return {
        'name': settings.app_name,
        'status': 'ok',
        'health': f'{settings.api_prefix}/health',
        'docs': '/docs',
    }


for web_asset in ('favicon.svg', 'logo.svg', 'manifest.webmanifest', 'sw.js'):
    web_asset_path = web_root / web_asset
    if web_asset_path.exists():
        app.add_api_route(
            f'/{web_asset}',
            lambda path=web_asset_path: FileResponse(path),
            include_in_schema=False,
        )

assets_root = web_root / 'assets'
if assets_root.exists():
    app.mount('/assets', StaticFiles(directory=assets_root), name='web-assets')


@app.on_event('startup')
async def on_startup() -> None:
    if settings.auto_create_schema:
        Base.metadata.create_all(bind=engine)
    await ws_manager.start()


@app.on_event('shutdown')
async def on_shutdown() -> None:
    await ws_manager.stop()


app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(chat_router, prefix=settings.api_prefix)
app.include_router(media_router, prefix=settings.api_prefix)
app.include_router(backup_router, prefix=settings.api_prefix)
app.include_router(calls_router, prefix=settings.api_prefix)
app.include_router(admin_router, prefix=settings.api_prefix)
app.include_router(keys_router, prefix=settings.api_prefix)
app.include_router(push_router, prefix=settings.api_prefix)
app.include_router(realtime_router, prefix=settings.api_prefix)
app.include_router(realtime_config_router, prefix=settings.api_prefix)
