"""Public awards scanning. NO AUTHENTICATION — the only such router here.

Everything user-supplied is validated before it reaches Chess.com, and the
per-IP limiter plus the 6-hour cache bound outbound traffic.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from ..database import get_db
from ..models import AwardScan
from ..services.awards.ratelimit import SlidingWindowLimiter
from ..services.awards.scanner import PlayerNotFound, UpstreamError, run_scan

router = APIRouter(prefix="/awards", tags=["awards"])

_limiter = SlidingWindowLimiter(max_events=5, window_seconds=3600)
_jobs: dict[str, dict] = {}
CACHE_TTL = timedelta(hours=6)


class ScanRequest(BaseModel):
    platform: str = Field(default="chesscom", pattern="^(chesscom)$")
    username: str = Field(pattern=r"^[A-Za-z0-9_-]{3,25}$")


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


@router.post("/scan", status_code=202)
async def start_scan(body: ScanRequest, request: Request, db=Depends(get_db)):
    username = body.username.lower()

    row = db.execute(
        select(AwardScan).where(AwardScan.platform == body.platform, AwardScan.username == username)
    ).scalar_one_or_none()
    # scanned_at is stored as naive UTC (matching every other timestamp
    # column in app/models.py), so compare against naive utcnow(), not an
    # aware datetime.now(timezone.utc).
    if row and datetime.utcnow() - row.scanned_at < CACHE_TTL:
        job_id = str(uuid.uuid4())
        _jobs[job_id] = {
            "status": "done",
            "progress": {"months_done": 0, "months_total": 0},
            "result": {
                "username": row.username, "platform": row.platform,
                "scanned_at": row.scanned_at.isoformat(), "games_parsed": row.games_parsed,
                "games_skipped": 0, "truncated": False, "measurements": row.measurements,
            },
        }
        return {"job_id": job_id, "cached": True}

    if not _limiter.allow(_client_ip(request)):
        raise HTTPException(429, "Too many scans from this address. Try again later.")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "queued", "progress": {"months_done": 0, "months_total": 0}}
    asyncio.create_task(_run(job_id, body.platform, username))
    return {"job_id": job_id, "cached": False}


async def _run(job_id: str, platform: str, username: str) -> None:
    job = _jobs[job_id]
    job["status"] = "running"

    def progress(done: int, total: int) -> None:
        job["progress"] = {"months_done": done, "months_total": total}

    try:
        job["result"] = await run_scan(platform, username, db=None, progress_cb=progress)
        job["status"] = "done"
    except PlayerNotFound:
        job.update(status="error", error="No such player on Chess.com.", retryable=False)
    except UpstreamError:
        job.update(status="error", error="Chess.com is not responding. Try again shortly.", retryable=True)
    except Exception:
        job.update(status="error", error="The scan failed unexpectedly.", retryable=True)


@router.get("/scan/{job_id}")
async def get_scan(job_id: str):
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Unknown scan.")
    return job
