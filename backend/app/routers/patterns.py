from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.pattern_engine import PatternEngine

router = APIRouter(tags=["patterns"])


@router.get("/patterns")
def get_patterns(db: Session = Depends(get_db)):
    engine = PatternEngine(db)
    return engine.generate_report()
