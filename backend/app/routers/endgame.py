from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import EndgameReport
from ..services.endgame_service import EndgameService

router = APIRouter(tags=["endgame"])


@router.get("/endgame", response_model=EndgameReport)
def get_endgame_report(
    platform: str | None = Query(None, description="Filter by platform"),
    time_class: str | None = Query(None, description="Filter by time class"),
    db: Session = Depends(get_db),
):
    service = EndgameService(db)
    return service.get_report(platform=platform, time_class=time_class)
