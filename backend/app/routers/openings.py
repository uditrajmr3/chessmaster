from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.opening_service import OpeningService

router = APIRouter(tags=["openings"])


@router.get("/openings/tree")
def get_opening_tree(
    platform: str | None = Query(None, description="Filter by platform (chesscom, lichess)"),
    time_class: str | None = Query(None, description="Filter by time class (rapid, blitz, bullet)"),
    db: Session = Depends(get_db),
):
    service = OpeningService(db)
    return service.get_tree(platform=platform, time_class=time_class)
