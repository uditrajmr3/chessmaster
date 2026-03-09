from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.export_service import ExportService

router = APIRouter(tags=["export"])


@router.get("/export/games/csv")
def export_games_csv(
    platform: str | None = Query(None),
    time_class: str | None = Query(None),
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    csv_data = service.export_games_csv(platform=platform, time_class=time_class)
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=games.csv"},
    )


@router.get("/export/analysis/csv")
def export_analysis_csv(
    game_id: str | None = Query(None),
    platform: str | None = Query(None),
    time_class: str | None = Query(None),
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    csv_data = service.export_analysis_csv(
        game_id=game_id, platform=platform, time_class=time_class
    )
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=analysis.csv"},
    )


@router.get("/export/games/json")
def export_games_json(
    platform: str | None = Query(None),
    time_class: str | None = Query(None),
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    return service.export_games_json(platform=platform, time_class=time_class)


@router.get("/export/summary")
def export_summary(
    platform: str | None = Query(None),
    time_class: str | None = Query(None),
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    return service.export_summary(platform=platform, time_class=time_class)
