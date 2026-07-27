from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, is_designated_admin
from app.db.session import get_db
from app.models.entities import BetaFeedback, User
from app.schemas.feedback import BetaFeedbackInput

router = APIRouter(prefix='/feedback', tags=['feedback'])

MIN_BETA_FEEDBACK_USES = 10


def _feedback_is_available(current_user: User, db: Session) -> bool:
    if (
        is_designated_admin(current_user)
        or not current_user.beta_feedback_eligible
        or current_user.beta_feedback_use_count < MIN_BETA_FEEDBACK_USES
    ):
        return False
    available_after = current_user.beta_feedback_available_after
    if available_after:
        if available_after.tzinfo is None:
            available_after = available_after.replace(tzinfo=timezone.utc)
        if available_after > datetime.now(timezone.utc):
            return False
    return db.scalar(select(BetaFeedback.id).where(BetaFeedback.user_id == current_user.id)) is None


@router.post('/usage')
def record_beta_usage(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if is_designated_admin(current_user) or not current_user.beta_feedback_eligible:
        return {'needs_beta_feedback': False, 'uses': current_user.beta_feedback_use_count}

    if db.scalar(select(BetaFeedback.id).where(BetaFeedback.user_id == current_user.id)) is None:
        current_user.beta_feedback_use_count += 1
        db.add(current_user)
        db.commit()

    return {
        'needs_beta_feedback': _feedback_is_available(current_user, db),
        'uses': current_user.beta_feedback_use_count,
    }


@router.post('/beta', status_code=status.HTTP_201_CREATED)
def submit_beta_feedback(
    data: BetaFeedbackInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    existing = db.scalar(select(BetaFeedback).where(BetaFeedback.user_id == current_user.id))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Feedback already submitted')
    if not _feedback_is_available(current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f'Feedback is available after {MIN_BETA_FEEDBACK_USES} Chatika sessions')

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
