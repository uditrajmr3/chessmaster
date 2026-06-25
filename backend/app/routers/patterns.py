from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..database import get_db
from ..services.pattern_engine import PatternEngine

router = APIRouter(tags=["patterns"])


@router.get("/patterns")
def get_patterns(
    platform: str | None = Query(None, description="Filter by platform (chesscom, lichess)"),
    time_class: str | None = Query(None, description="Filter by time class (rapid, blitz, bullet)"),
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    engine = PatternEngine(db, user_id=user.id)
    return engine.generate_report(platform=platform, time_class=time_class)
