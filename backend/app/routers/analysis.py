import asyncio

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AnalysisJob, Game
from ..schemas import AnalyzeStatus
from ..services.stockfish_analyzer import StockfishAnalyzer

router = APIRouter(tags=["analysis"])

_analysis_status: dict = {"status": "idle", "total": 0, "completed": 0, "current_game": None}


async def _run_analysis():
    global _analysis_status
    _analysis_status["status"] = "running"
    try:
        analyzer = StockfishAnalyzer()
        await analyzer.analyze_all(_analysis_status)
        _analysis_status["status"] = "done"
    except Exception as e:
        _analysis_status["status"] = "error"
        _analysis_status["current_game"] = str(e)


@router.post("/analyze")
async def start_analysis():
    if _analysis_status.get("status") == "running":
        return {"message": "Analysis already in progress"}
    asyncio.ensure_future(_run_analysis())
    return {"message": "Analysis started"}


@router.get("/analyze/status", response_model=AnalyzeStatus)
def get_analysis_status():
    return AnalyzeStatus(**_analysis_status)
