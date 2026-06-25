from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..database import get_db
from ..schemas import DigestReport
from ..services.digest_service import DigestService

router = APIRouter(tags=["digest"])


@router.get("/digest", response_model=DigestReport)
def get_digest(
    days: int = Query(7, ge=1, le=90, description="Number of days to include"),
    platform: str | None = Query(None, description="Filter by platform"),
    time_class: str | None = Query(None, description="Filter by time class"),
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    service = DigestService(db, user_id=str(user.id))
    return service.get_digest(days=days, platform=platform, time_class=time_class)
