import asyncio

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from ..models import Report
from ..schemas import ReportOut
from ..services.report_generator import ReportGenerator

router = APIRouter(tags=["report"])

_report_status: dict = {"status": "idle", "error": None}


async def _run_report_generation():
    global _report_status
    _report_status = {"status": "generating", "error": None}
    db = SessionLocal()
    try:
        generator = ReportGenerator(db)
        await generator.generate()
        _report_status["status"] = "done"
    except Exception as e:
        _report_status["status"] = "error"
        _report_status["error"] = str(e)
    finally:
        db.close()


@router.post("/report/generate")
async def generate_report():
    if _report_status.get("status") == "generating":
        return {"message": "Report generation already in progress"}
    asyncio.ensure_future(_run_report_generation())
    return {"message": "Report generation started"}


@router.get("/report/status")
def get_report_status():
    return _report_status


@router.get("/report/latest", response_model=ReportOut | None)
def get_latest_report(db: Session = Depends(get_db)):
    report = db.query(Report).order_by(Report.generated_at.desc()).first()
    if not report:
        return None
    import json
    return ReportOut(
        id=report.id,
        generated_at=report.generated_at,
        games_count=report.games_count,
        report_text=report.report_text,
        report_json=json.loads(report.report_json),
    )
