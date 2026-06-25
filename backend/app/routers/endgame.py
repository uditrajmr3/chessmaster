from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..database import get_db
from ..schemas import EndgameReport
from ..services.endgame_service import EndgameService

router = APIRouter(tags=["endgame"])


@router.get("/endgame", response_model=EndgameReport)
def get_endgame_report(
    platform: str | None = Query(None, description="Filter by platform"),
    time_class: str | None = Query(None, description="Filter by time class"),
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    service = EndgameService(db, user_id=str(user.id))
    return service.get_report(platform=platform, time_class=time_class)
