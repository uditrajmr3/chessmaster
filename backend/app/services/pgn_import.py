"""PGN Import: parse and import PGN files (for OTB or other platform games)."""

import io
import uuid
from datetime import datetime

import chess.pgn
from sqlalchemy.orm import Session

from ..models import Game


def import_pgn(
    db: Session,
    pgn_text: str,
    usernames: list[str] | str,
    user_id: uuid.UUID,
) -> dict:
    """Parse a PGN string (potentially multi-game) and import games.

    Args:
        db: Database session.
        pgn_text: Raw PGN text (may contain multiple games).
        usernames: One or more player usernames used for color/result detection.
                   Accepts a list (preferred) or a single string for backward compat.
        user_id: The authenticated user's UUID. All imported games are stamped with this.
    """
    if isinstance(usernames, str):
        usernames = [usernames]

    stream = io.StringIO(pgn_text)
    imported = 0
    skipped = 0
    errors = []

    while True:
        try:
            game = chess.pgn.read_game(stream)
        except Exception as e:
            errors.append(f"Parse error: {e}")
            break

        if game is None:
            break

        result = _import_single_game(db, game, usernames, user_id)
        if result == "imported":
            imported += 1
        elif result == "skipped":
            skipped += 1
        else:
            errors.append(result)

    db.commit()

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
    }


def _import_single_game(
    db: Session,
    game: chess.pgn.Game,
    usernames: list[str],
    user_id: uuid.UUID,
) -> str:
    """Import a single parsed PGN game. Returns 'imported', 'skipped', or error string."""
    headers = game.headers

    # Extract basic info
    white = headers.get("White", "Unknown")
    black = headers.get("Black", "Unknown")
    result_str = headers.get("Result", "*")

    # Determine player color by matching any of the user's known usernames
    white_lower = white.lower()
    black_lower = black.lower()
    user_name_set = {u.lower() for u in usernames}

    if white_lower in user_name_set:
        player_color = "white"
    elif black_lower in user_name_set:
        player_color = "black"
    else:
        # Default to white if no username matches either side
        player_color = "white"

    # Parse result
    if result_str == "1-0":
        result = "win" if player_color == "white" else "loss"
    elif result_str == "0-1":
        result = "win" if player_color == "black" else "loss"
    elif result_str == "1/2-1/2":
        result = "draw"
    else:
        result = "draw"

    # Generate a stable UUID-based game id
    game_uuid = str(uuid.uuid4())
    platform_id = game_uuid[:12]
    game_id = game_uuid

    # Deduplicate: check (user_id, platform, platform_id)
    existing = (
        db.query(Game)
        .filter_by(user_id=user_id, platform="pgn", platform_id=platform_id)
        .first()
    )
    if existing:
        return "skipped"

    # Parse date
    date_str = headers.get("Date", headers.get("UTCDate", ""))
    time_str = headers.get("Time", headers.get("UTCTime", ""))
    played_at = _parse_date(date_str, time_str)

    # Parse ratings
    white_elo = _safe_int(headers.get("WhiteElo", "0"))
    black_elo = _safe_int(headers.get("BlackElo", "0"))
    player_rating = white_elo if player_color == "white" else black_elo
    opponent_rating = black_elo if player_color == "white" else white_elo

    # Parse opening
    eco = headers.get("ECO", "")
    opening_name = headers.get("Opening", headers.get("ECOUrl", ""))

    # Parse time control
    time_control = headers.get("TimeControl", "-")
    time_class = _classify_time_control(time_control)

    # Count moves
    board = game.board()
    num_moves = 0
    for move in game.mainline_moves():
        board.push(move)
        num_moves += 1
    num_moves = (num_moves + 1) // 2  # Convert plies to full moves

    # Build PGN string
    exporter = chess.pgn.StringExporter(headers=True, variations=True, comments=True)
    pgn_str = game.accept(exporter)

    # Result detail
    termination = headers.get("Termination", "")
    result_detail = termination if termination else result_str

    db_game = Game(
        id=game_id,
        user_id=user_id,
        platform="pgn",
        platform_id=platform_id,
        pgn=pgn_str,
        white_username=white,
        black_username=black,
        player_color=player_color,
        time_class=time_class,
        time_control=time_control,
        result=result,
        result_detail=result_detail,
        player_rating=player_rating or 0,
        opponent_rating=opponent_rating or 0,
        opening_eco=eco or None,
        opening_name=opening_name or None,
        num_moves=max(num_moves, 1),
        played_at=played_at,
        platform_accuracy=None,
    )
    db.add(db_game)
    return "imported"


def _parse_date(date_str: str, time_str: str) -> datetime:
    """Parse PGN date format (YYYY.MM.DD) into datetime."""
    if not date_str or date_str == "????.??.??":
        return datetime.now()

    date_str = date_str.replace(".", "-")
    full = f"{date_str} {time_str}" if time_str else date_str

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(full, fmt)
        except ValueError:
            continue

    return datetime.now()


def _safe_int(s: str) -> int:
    try:
        return int(s)
    except (ValueError, TypeError):
        return 0


def _classify_time_control(tc: str) -> str:
    """Classify time control string into time class."""
    if tc == "-" or not tc:
        return "classical"

    try:
        # Format: "300" or "300+5" or "180+2"
        parts = tc.split("+")
        base = int(parts[0])
        increment = int(parts[1]) if len(parts) > 1 else 0
        total = base + 40 * increment  # estimated total time

        if total < 180:
            return "bullet"
        elif total < 600:
            return "blitz"
        elif total < 1800:
            return "rapid"
        else:
            return "classical"
    except (ValueError, IndexError):
        return "classical"
