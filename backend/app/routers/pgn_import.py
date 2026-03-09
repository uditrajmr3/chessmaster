from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.pgn_import import import_pgn

router = APIRouter(tags=["import"])


@router.post("/import/pgn")
async def upload_pgn(
    file: UploadFile = File(...),
    username: str = Form("Player"),
    db: Session = Depends(get_db),
):
    """Import games from a PGN file."""
    content = await file.read()
    pgn_text = content.decode("utf-8", errors="replace")
    result = import_pgn(db, pgn_text, username)
    return result


@router.post("/import/pgn-text")
def import_pgn_text(
    body: dict,
    db: Session = Depends(get_db),
):
    """Import games from raw PGN text."""
    pgn_text = body.get("pgn", "")
    username = body.get("username", "Player")
    result = import_pgn(db, pgn_text, username)
    return result
