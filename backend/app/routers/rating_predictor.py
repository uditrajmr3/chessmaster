from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..database import get_db
from ..schemas import RatingPredictionReport
from ..services.rating_predictor import RatingPredictor

router = APIRouter(tags=["rating-predictor"])


@router.get("/rating-predictor", response_model=RatingPredictionReport)
def get_rating_prediction(
    platform: str | None = Query(None, description="Filter by platform"),
    time_class: str | None = Query(None, description="Filter by time class"),
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    predictor = RatingPredictor(db, user_id=user.id)
    return predictor.get_prediction(platform=platform, time_class=time_class)
