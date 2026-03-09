from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import TiltReport
from ..services.tilt_detector import TiltDetector

router = APIRouter(tags=["tilt"])


@router.get("/tilt", response_model=TiltReport)
def get_tilt_report(db: Session = Depends(get_db)):
    detector = TiltDetector(db)
    return detector.analyze()
