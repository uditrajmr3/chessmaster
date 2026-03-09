from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.pattern_engine import PatternEngine

router = APIRouter(tags=["patterns"])


@router.get("/patterns")
def get_patterns(
    platform: str | None = Query(None, description="Filter by platform (chesscom, lichess)"),
    time_class: str | None = Query(None, description="Filter by time class (rapid, blitz, bullet)"),
    db: Session = Depends(get_db),
):
    engine = PatternEngine(db)
    return engine.generate_report(platform=platform, time_class=time_class)
