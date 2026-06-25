from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..database import get_db
from ..services.time_management_service import TimeManagementService

router = APIRouter(tags=["time-management"])


@router.get("/time-management")
def get_time_management_profile(
    platform: str | None = Query(None, description="Filter by platform (chesscom, lichess)"),
    time_class: str | None = Query(None, description="Filter by time class (rapid, blitz, bullet)"),
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    service = TimeManagementService(db, user_id=str(user.id))
    return service.get_profile(platform=platform, time_class=time_class)
