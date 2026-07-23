from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import BetaFeedback, User
from app.schemas.feedback import BetaFeedbackInput

router = APIRouter(prefix='/feedback', tags=['feedback'])


@router.post('/beta', status_code=status.HTTP_201_CREATED)
def submit_beta_feedback(
    data: BetaFeedbackInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    existing = db.scalar(select(BetaFeedback).where(BetaFeedback.user_id == current_user.id))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Feedback already submitted')
    if not current_user.beta_feedback_eligible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Feedback survey is not available')

    feedback = BetaFeedback(
        user_id=current_user.id,
        rating=data.rating,
        favorite_feature=data.favorite_feature,
        improvement_area=data.improvement_area,
        comment=data.comment.strip() if data.comment else None,
        app_version=data.app_version,
        platform=data.platform,
    )
    current_user.beta_feedback_eligible = False
    db.add(feedback)
    db.add(current_user)
    db.commit()
    return {'message': 'Thank you for helping improve Chatika'}
