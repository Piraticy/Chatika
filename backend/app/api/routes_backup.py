from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import BackupSnapshot, User
from app.schemas.backup import BackupCreateInput, BackupOut
from app.services.backup_crypto import decrypt_text, encrypt_text

router = APIRouter(prefix='/backup', tags=['backup'])


@router.post('/create', response_model=BackupOut)
def create_backup(data: BackupCreateInput, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BackupOut:
    snapshot = BackupSnapshot(user_id=current_user.id, encrypted_payload=encrypt_text(data.payload_json))
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return BackupOut(id=snapshot.id, created_at=snapshot.created_at, payload_json=data.payload_json)


@router.get('/latest', response_model=Optional[BackupOut])
def latest_backup(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Optional[BackupOut]:
    snapshot = db.scalar(
        select(BackupSnapshot)
        .where(BackupSnapshot.user_id == current_user.id)
        .order_by(BackupSnapshot.created_at.desc())
    )
    if not snapshot:
        return None
    return BackupOut(
        id=snapshot.id,
        created_at=snapshot.created_at,
        payload_json=decrypt_text(snapshot.encrypted_payload),
    )
