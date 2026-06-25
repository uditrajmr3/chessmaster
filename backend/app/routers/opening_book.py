from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..database import get_db
from ..services.opening_book import OpeningBookService

router = APIRouter(tags=["opening-book"])


@router.get("/opening-book/{game_id}")
def get_book_analysis(
    game_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    """Analyze a game's opening moves against the player's own book."""
    service = OpeningBookService(db, user_id=str(user.id))
    result = service.get_book_analysis(game_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return result


@router.get("/opening-book")
def get_repertoire(
    color: str | None = Query(None, description="Filter by player color"),
    platform: str | None = Query(None),
    time_class: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    """Get the player's opening repertoire — most common move sequences."""
    service = OpeningBookService(db, user_id=str(user.id))
    return service.get_repertoire(color=color, platform=platform, time_class=time_class)
