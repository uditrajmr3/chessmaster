import asyncio

from fastapi import APIRouter, Depends, HTTPException

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..schemas import SyncStatus
from ..services.sync_service import SyncService

router = APIRouter(tags=["sync"])

# Per-user status dict keyed by str(user_id)
_sync_status: dict[str, dict] = {}


async def _run_sync(user_id: str, lichess_username: str | None, chesscom_username: str | None):
    _sync_status[user_id] = {"status": "syncing", "games_fetched": 0, "message": "Starting sync..."}
    try:
        service = SyncService()
        count = await service.sync_all(
            user_id=user_id,
            lichess_username=lichess_username,
            chesscom_username=chesscom_username,
            status=_sync_status[user_id],
        )
        _sync_status[user_id] = {"status": "done", "games_fetched": count, "message": "Sync complete"}
    except Exception as e:
        _sync_status[user_id] = {"status": "error", "games_fetched": 0, "message": str(e)}


@router.post("/sync")
async def start_sync(user: User = Depends(current_verified_user)):
    if not (user.lichess_username or user.chesscom_username):
        raise HTTPException(400, "Link a Lichess or Chess.com username first")
    if _sync_status.get(str(user.id), {}).get("status") == "syncing":
        return {"message": "Sync already in progress"}
    asyncio.ensure_future(
        _run_sync(str(user.id), user.lichess_username, user.chesscom_username)
    )
    return {"message": "Sync started"}


@router.get("/sync/status", response_model=SyncStatus)
def get_sync_status(user: User = Depends(current_verified_user)):
    return SyncStatus(**_sync_status.get(str(user.id), {"status": "idle", "games_fetched": 0, "message": ""}))
