"""Analysis router — client-side Stockfish model.

The browser runs Stockfish and posts per-move evaluations.  The server:
  - GET  /analyze/pending  → returns games that need analysis
  - POST /analyze/results  → ingests browser-computed evals
  - GET  /analyze/status   → lightweight counts for the current user

Stockfish runs in the browser; the server only classifies and stores results.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..database import get_db
from ..models import AnalysisJob, Game
from ..schemas import AnalyzeResultsIn, AnalyzeStatus
from ..services.analysis_ingest import store_results

router = APIRouter(tags=["analysis"])


@router.get("/analyze/pending")
def pending(
    user: User = Depends(current_verified_user),
    db: Session = Depends(get_db),
):
    """Return the authenticated user's games that do not yet have a completed AnalysisJob."""
    done = {
        row.game_id
        for row in db.query(AnalysisJob.game_id).filter(
            AnalysisJob.user_id == str(user.id),
            AnalysisJob.status == "completed",
        )
    }
    games = db.query(Game).filter(Game.user_id == str(user.id)).all()
    return [
        {"game_id": g.id, "pgn": g.pgn, "player_color": g.player_color}
        for g in games
        if g.id not in done
    ]


@router.post("/analyze/results")
def results(
    payload: AnalyzeResultsIn,
    user: User = Depends(current_verified_user),
    db: Session = Depends(get_db),
):
    """Ingest browser-computed Stockfish evaluations for a game owned by the user."""
    store_results(db, str(user.id), payload)
    return {"status": "ok"}


@router.get("/analyze/status", response_model=AnalyzeStatus)
def get_analysis_status(
    user: User = Depends(current_verified_user),
    db: Session = Depends(get_db),
):
    """Return lightweight analysis counts for the authenticated user."""
    jobs = db.query(AnalysisJob).filter(AnalysisJob.user_id == str(user.id)).all()
    total_games = db.query(Game).filter(Game.user_id == str(user.id)).count()
    completed = sum(1 for j in jobs if j.status == "completed")
    return AnalyzeStatus(
        status="done" if completed >= total_games and total_games > 0 else "idle",
        total=total_games,
        completed=completed,
        current_game=None,
    )
