from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..database import get_db
from ..services.opening_service import OpeningService

router = APIRouter(tags=["openings"])


@router.get("/openings/tree")
def get_opening_tree(
    platform: str | None = Query(None, description="Filter by platform (chesscom, lichess)"),
    time_class: str | None = Query(None, description="Filter by time class (rapid, blitz, bullet)"),
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    service = OpeningService(db, user_id=str(user.id))
    return service.get_tree(platform=platform, time_class=time_class)
