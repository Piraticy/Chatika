from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.entities import User
from app.schemas.realtime import IceConfigOut

router = APIRouter(prefix='/realtime', tags=['realtime'])


@router.get('/ice-config', response_model=IceConfigOut)
def ice_config(_current_user: User = Depends(get_current_user)) -> IceConfigOut:
    return IceConfigOut(force_turn=settings.force_turn, ice_servers=settings.ice_servers)


@router.get('/push-config')
def push_config(_current_user: User = Depends(get_current_user)) -> dict:
    return {'vapid_public_key': settings.vapid_public_key}
