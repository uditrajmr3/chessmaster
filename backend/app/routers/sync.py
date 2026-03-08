import asyncio

from fastapi import APIRouter

from ..schemas import SyncRequest, SyncStatus
from ..services.sync_service import SyncService

router = APIRouter(tags=["sync"])

_sync_status: dict = {"status": "idle", "games_fetched": 0, "message": ""}


async def _run_sync(username: str):
    global _sync_status
    _sync_status = {"status": "syncing", "games_fetched": 0, "message": "Starting sync..."}
    try:
        service = SyncService()
        count = await service.sync_all(username, _sync_status)
        _sync_status = {"status": "done", "games_fetched": count, "message": "Sync complete"}
    except Exception as e:
        _sync_status = {"status": "error", "games_fetched": 0, "message": str(e)}


@router.post("/sync")
async def start_sync(req: SyncRequest):
    if _sync_status.get("status") == "syncing":
        return {"message": "Sync already in progress"}
    asyncio.ensure_future(_run_sync(req.username))
    return {"message": "Sync started"}


@router.get("/sync/status", response_model=SyncStatus)
def get_sync_status():
    return SyncStatus(**_sync_status)
