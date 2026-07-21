import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import MediaPreference, User
from app.schemas.media import MediaPreferenceInput, MediaPreferenceOut

router = APIRouter(prefix='/media', tags=['media'])


@router.get('/preference', response_model=MediaPreferenceOut)
def get_preference(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MediaPreferenceOut:
    pref = db.scalar(select(MediaPreference).where(MediaPreference.user_id == current_user.id))
    if not pref:
        pref = MediaPreference(user_id=current_user.id, storage_mode='device')
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return MediaPreferenceOut(user_id=pref.user_id, storage_mode=pref.storage_mode)


@router.put('/preference', response_model=MediaPreferenceOut)
def set_preference(data: MediaPreferenceInput, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MediaPreferenceOut:
    pref = db.scalar(select(MediaPreference).where(MediaPreference.user_id == current_user.id))
    if not pref:
        pref = MediaPreference(user_id=current_user.id, storage_mode=data.storage_mode)
    else:
        pref.storage_mode = data.storage_mode
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return MediaPreferenceOut(user_id=pref.user_id, storage_mode=pref.storage_mode)


@router.post('/upload')
async def upload_media(file: UploadFile = File(...), current_user: User = Depends(get_current_user)) -> dict:
    ext = Path(file.filename or '').suffix.lower()
    if ext not in {'.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.webm', '.mp3', '.wav', '.ogg', '.m4a', '.pdf'}:
        raise HTTPException(status_code=400, detail='Unsupported file type')

    user_dir = Path(settings.media_root) / current_user.id
    user_dir.mkdir(parents=True, exist_ok=True)

    out_path = user_dir / f'{os.urandom(8).hex()}{ext}'
    content = await file.read(settings.media_max_bytes + 1)
    if len(content) > settings.media_max_bytes:
        raise HTTPException(status_code=413, detail='Media file is too large')
    out_path.write_bytes(content)

    return {'media_url': f'/api/v1/media/files/{current_user.id}/{out_path.name}'}


@router.get('/files/{owner_id}/{file_name}')
def get_media_file(owner_id: str, file_name: str) -> FileResponse:
    safe_name = Path(file_name).name
    media_root = Path(settings.media_root).resolve()
    file_path = (media_root / owner_id / safe_name).resolve()
    if media_root not in file_path.parents or not file_path.is_file():
        raise HTTPException(status_code=404, detail='Media file not found')
    return FileResponse(file_path)
