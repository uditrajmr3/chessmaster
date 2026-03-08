from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.time_management_service import TimeManagementService

router = APIRouter(tags=["time-management"])


@router.get("/time-management")
def get_time_management_profile(db: Session = Depends(get_db)):
    service = TimeManagementService(db)
    return service.get_profile()
