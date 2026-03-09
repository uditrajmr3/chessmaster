from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import RatingPredictionReport
from ..services.rating_predictor import RatingPredictor

router = APIRouter(tags=["rating-predictor"])


@router.get("/rating-predictor", response_model=RatingPredictionReport)
def get_rating_prediction(
    platform: str | None = Query(None, description="Filter by platform"),
    time_class: str | None = Query(None, description="Filter by time class"),
    db: Session = Depends(get_db),
):
    predictor = RatingPredictor(db)
    return predictor.get_prediction(platform=platform, time_class=time_class)
