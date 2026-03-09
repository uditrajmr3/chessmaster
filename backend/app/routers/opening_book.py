from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.opening_book import OpeningBookService

router = APIRouter(tags=["opening-book"])


@router.get("/opening-book/{game_id}")
def get_book_analysis(
    game_id: str,
    db: Session = Depends(get_db),
):
    """Analyze a game's opening moves against the player's own book."""
    service = OpeningBookService(db)
    return service.get_book_analysis(game_id)


@router.get("/opening-book")
def get_repertoire(
    color: str | None = Query(None, description="Filter by player color"),
    platform: str | None = Query(None),
    time_class: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Get the player's opening repertoire — most common move sequences."""
    service = OpeningBookService(db)
    return service.get_repertoire(color=color, platform=platform, time_class=time_class)
