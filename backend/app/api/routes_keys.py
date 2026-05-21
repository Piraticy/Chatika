import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User, UserKeyBundle
from app.schemas.keys import UserKeyBundleOut, UserKeyBundleUpsertInput

router = APIRouter(prefix='/keys', tags=['keys'])


@router.put('/me')
def upsert_my_bundle(
    data: UserKeyBundleUpsertInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    bundle = db.scalar(select(UserKeyBundle).where(UserKeyBundle.user_id == current_user.id))
    if not bundle:
        bundle = UserKeyBundle(user_id=current_user.id)

    bundle.identity_key = data.identity_key
    bundle.signed_prekey = data.signed_prekey
    bundle.signed_prekey_signature = data.signed_prekey_signature
    bundle.one_time_prekeys_json = json.dumps(data.one_time_prekeys)

    db.add(bundle)
    db.commit()
    return {'message': 'Key bundle updated'}


@router.get('/bundle/{target_user_id}', response_model=UserKeyBundleOut)
def get_bundle(
    target_user_id: str,
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserKeyBundleOut:
    bundle = db.scalar(select(UserKeyBundle).where(UserKeyBundle.user_id == target_user_id))
    if not bundle:
        raise HTTPException(status_code=404, detail='Target key bundle not found')

    prekeys = json.loads(bundle.one_time_prekeys_json or '[]')
    one_time_prekey = prekeys.pop(0) if prekeys else None
    bundle.one_time_prekeys_json = json.dumps(prekeys)
    db.add(bundle)
    db.commit()

    return UserKeyBundleOut(
        user_id=bundle.user_id,
        identity_key=bundle.identity_key,
        signed_prekey=bundle.signed_prekey,
        signed_prekey_signature=bundle.signed_prekey_signature,
        one_time_prekey=one_time_prekey,
    )
