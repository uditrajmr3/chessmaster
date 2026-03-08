import asyncio
import threading

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AnalysisJob, Game
from ..schemas import AnalyzeStatus
from ..services.stockfish_analyzer import StockfishAnalyzer

router = APIRouter(tags=["analysis"])

_analysis_status: dict = {"status": "idle", "total": 0, "completed": 0, "current_game": None}
_analysis_lock = threading.Lock()
_analysis_task: asyncio.Task | None = None


async def _run_analysis():
    global _analysis_task
    _analysis_status["status"] = "running"
    try:
        analyzer = StockfishAnalyzer()
        await analyzer.analyze_all(_analysis_status)
        _analysis_status["status"] = "done"
    except Exception as e:
        _analysis_status["status"] = "error"
        _analysis_status["current_game"] = str(e)
    finally:
        _analysis_task = None


@router.post("/analyze")
async def start_analysis():
    global _analysis_task
    with _analysis_lock:
        # Check if a task is actually still running
        if _analysis_task is not None and not _analysis_task.done():
            return {"message": "Analysis already in progress"}
        # Reset stale status from a previous crashed run
        _analysis_status.update({"status": "idle", "total": 0, "completed": 0, "current_game": None})
        _analysis_task = asyncio.ensure_future(_run_analysis())
    return {"message": "Analysis started"}


@router.get("/analyze/status", response_model=AnalyzeStatus)
def get_analysis_status():
    return AnalyzeStatus(**_analysis_status)
