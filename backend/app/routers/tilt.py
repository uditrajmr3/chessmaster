from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..database import get_db
from ..schemas import TiltReport
from ..services.tilt_detector import TiltDetector

router = APIRouter(tags=["tilt"])


@router.get("/tilt", response_model=TiltReport)
def get_tilt_report(
    platform: str | None = Query(None, description="Filter by platform (chesscom, lichess)"),
    time_class: str | None = Query(None, description="Filter by time class (rapid, blitz, bullet)"),
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    detector = TiltDetector(db, user_id=user.id)
    return detector.analyze(platform=platform, time_class=time_class)
