import asyncio
import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..config import settings
from ..database import SessionLocal, get_db
from ..models import Report
from ..schemas import ReportOut
from ..services.report_generator import ReportGenerator

router = APIRouter(tags=["report"])


def _reports_used_last_30d(db: Session, user_id) -> int:
    """Successful reports a user generated in the rolling 30-day window.
    A Report row only exists on success, so failed runs don't consume quota."""
    cutoff = datetime.utcnow() - timedelta(days=30)
    return (
        db.query(Report)
        .filter(Report.user_id == user_id, Report.generated_at >= cutoff)
        .count()
    )

# Per-user report-generation status keyed by str(user_id).
# NOTE: in-memory and process-local. Under a multi-worker deployment
# (e.g. gunicorn --workers > 1) each worker has its own copy, so a user
# may POST /report/generate on one worker and read idle status from another.
# Fine for single-worker dev/staging; move to a shared store (Redis/DB) for scale-out.
_report_status: dict[str, dict] = {}


async def _run_report_generation(user_id: str):
    _report_status[user_id] = {"status": "generating", "error": None}
    db = SessionLocal()
    try:
        generator = ReportGenerator(db, user_id=user_id)
        await generator.generate()
        _report_status[user_id]["status"] = "done"
    except Exception as e:
        _report_status[user_id]["status"] = "error"
        _report_status[user_id]["error"] = str(e)
    finally:
        db.close()


@router.post("/report/generate")
async def generate_report(
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    user_key = str(user.id)
    if _report_status.get(user_key, {}).get("status") == "generating":
        return {"message": "Report generation already in progress"}

    quota = settings.report_monthly_quota
    if quota > 0:
        used = _reports_used_last_30d(db, user.id)
        if used >= quota:
            return {
                "message": (
                    f"You've used all {quota} AI Coach reports for this month. "
                    "Your quota resets on a rolling 30-day basis."
                ),
                "quota_exceeded": True,
                "used": used,
                "limit": quota,
            }

    asyncio.ensure_future(_run_report_generation(user_key))
    return {"message": "Report generation started"}


@router.get("/report/quota")
def get_report_quota(
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    """AI Coach usage against the free-tier cap (0 limit = unlimited)."""
    limit = settings.report_monthly_quota
    used = _reports_used_last_30d(db, user.id)
    return {
        "used": used,
        "limit": limit,
        "remaining": None if limit == 0 else max(0, limit - used),
        "unlimited": limit == 0,
    }


@router.get("/report/status")
def get_report_status(user: User = Depends(current_verified_user)):
    user_key = str(user.id)
    return _report_status.get(user_key, {"status": "idle", "error": None})


@router.get("/report/latest", response_model=ReportOut | None)
def get_latest_report(
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    report = (
        db.query(Report)
        .filter(Report.user_id == user.id)
        .order_by(Report.generated_at.desc())
        .first()
    )
    if not report:
        return None
    return ReportOut(
        id=report.id,
        generated_at=report.generated_at,
        games_count=report.games_count,
        report_text=report.report_text,
        report_json=json.loads(report.report_json),
    )
