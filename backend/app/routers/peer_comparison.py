from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import PeerComparisonReport
from ..services.peer_comparison import PeerComparisonService

router = APIRouter(tags=["peer-comparison"])


@router.get("/peer-comparison", response_model=PeerComparisonReport)
def get_peer_comparison(
    platform: str | None = Query(None, description="Filter by platform"),
    time_class: str | None = Query(None, description="Filter by time class"),
    db: Session = Depends(get_db),
):
    service = PeerComparisonService(db)
    return service.get_comparison(platform=platform, time_class=time_class)
