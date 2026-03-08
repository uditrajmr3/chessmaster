from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import PuzzleOut, PuzzleResult, PuzzleStats, PuzzleSubmit
from ..services.puzzle_service import PuzzleService

router = APIRouter(tags=["puzzles"])


@router.get("/puzzles/next", response_model=PuzzleOut | None)
def get_next_puzzle(
    phase: str | None = Query(None, description="Filter by game phase"),
    motif: str | None = Query(None, description="Filter by tactical motif"),
    db: Session = Depends(get_db),
):
    service = PuzzleService(db)
    puzzle = service.get_next_puzzle(phase=phase, motif=motif)
    if not puzzle:
        return None
    return puzzle


@router.post("/puzzles/{puzzle_id}/submit", response_model=PuzzleResult)
def submit_puzzle_answer(
    puzzle_id: int,
    body: PuzzleSubmit,
    db: Session = Depends(get_db),
):
    service = PuzzleService(db)
    try:
        result = service.submit_answer(puzzle_id, body.move_uci)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result


@router.get("/puzzles/stats", response_model=PuzzleStats)
def get_puzzle_stats(db: Session = Depends(get_db)):
    service = PuzzleService(db)
    return service.get_stats()
