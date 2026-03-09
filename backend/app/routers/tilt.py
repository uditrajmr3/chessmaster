from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import TiltReport
from ..services.tilt_detector import TiltDetector

router = APIRouter(tags=["tilt"])


@router.get("/tilt", response_model=TiltReport)
def get_tilt_report(
    platform: str | None = Query(None, description="Filter by platform (chesscom, lichess)"),
    time_class: str | None = Query(None, description="Filter by time class (rapid, blitz, bullet)"),
    db: Session = Depends(get_db),
):
    detector = TiltDetector(db)
    return detector.analyze(platform=platform, time_class=time_class)
