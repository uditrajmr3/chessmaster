from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.pgn_import import import_pgn
from ..auth.deps import current_verified_user
from ..auth.models import User

router = APIRouter(tags=["import"])


@router.post("/import/pgn")
async def upload_pgn(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    """Import games from a PGN file. Requires authentication."""
    content = await file.read()
    pgn_text = content.decode("utf-8", errors="replace")
    # Resolve player usernames from the authenticated user's linked accounts
    usernames = _resolve_usernames(user)
    result = import_pgn(db, pgn_text, usernames, user.id)
    return result


@router.post("/import/pgn-text")
def import_pgn_text(
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    """Import games from raw PGN text. Requires authentication."""
    pgn_text = body.get("pgn", "")
    # Resolve player usernames from the authenticated user's linked accounts
    usernames = _resolve_usernames(user)
    result = import_pgn(db, pgn_text, usernames, user.id)
    return result


def _resolve_usernames(user: User) -> list[str]:
    """Return a list of known usernames for this user (for color/result detection)."""
    names = []
    if user.lichess_username:
        names.append(user.lichess_username.lower())
    if user.chesscom_username:
        names.append(user.chesscom_username.lower())
    return names
