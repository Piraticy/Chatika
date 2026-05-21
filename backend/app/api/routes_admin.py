from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.entities import User
from app.schemas.admin import AddUserInput, ApproveUserInput, RemoveUserInput
from app.services.security import hash_password

router = APIRouter(prefix='/admin', tags=['admin'])


@router.get('/pending-users')
def pending_users(_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> list[dict]:
    users = db.scalars(select(User).where(User.is_approved.is_(False))).all()
    return [{'id': u.id, 'username': u.username, 'phone_number': u.phone_number} for u in users]


@router.post('/approve-user')
def approve_user(data: ApproveUserInput, _admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> dict:
    user = db.get(User, data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    user.is_approved = True
    db.add(user)
    db.commit()
    return {'message': 'User approved'}


@router.post('/remove-user')
def remove_user(data: RemoveUserInput, _admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> dict:
    user = db.get(User, data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    db.delete(user)
    db.commit()
    return {'message': 'User removed'}


@router.post('/add-user')
def add_user(data: AddUserInput, _admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> dict:
    existing = db.scalar(select(User).where((User.username == data.username) | (User.phone_number == data.phone_number)))
    if existing:
        raise HTTPException(status_code=409, detail='Username or phone number already exists')

    user = User(
        username=data.username,
        phone_number=data.phone_number,
        password_hash=hash_password(data.password),
        is_approved=True,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    return {'message': 'User added', 'user_id': user.id}
