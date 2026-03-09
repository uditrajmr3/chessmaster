from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.time_management_service import TimeManagementService

router = APIRouter(tags=["time-management"])


@router.get("/time-management")
def get_time_management_profile(
    platform: str | None = Query(None, description="Filter by platform (chesscom, lichess)"),
    time_class: str | None = Query(None, description="Filter by time class (rapid, blitz, bullet)"),
    db: Session = Depends(get_db),
):
    service = TimeManagementService(db)
    return service.get_profile(platform=platform, time_class=time_class)
