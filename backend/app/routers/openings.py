from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.opening_service import OpeningService

router = APIRouter(tags=["openings"])


@router.get("/openings/tree")
def get_opening_tree(db: Session = Depends(get_db)):
    service = OpeningService(db)
    return service.get_tree()
