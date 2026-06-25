from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import httpx

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..database import get_db
from ..schemas import ScoutReport, ScoutRequest
from ..services.scouting_service import ScoutingService

router = APIRouter(tags=["scouting"])


@router.post("/scouting/scout", response_model=ScoutReport)
async def scout_opponent(
    body: ScoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    if body.platform not in ("chesscom", "lichess"):
        raise HTTPException(status_code=422, detail="Platform must be 'chesscom' or 'lichess'")

    service = ScoutingService(db, user_id=user.id)
    try:
        report = await service.scout_opponent(
            opponent_username=body.opponent_username,
            platform=body.platform,
            max_games=body.max_games,
        )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"User '{body.opponent_username}' not found on {body.platform}")
        raise HTTPException(status_code=502, detail=f"Error fetching from {body.platform}: {e.response.status_code}")

    return report
