import json
from datetime import datetime

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Game, SyncState
from .chesscom_client import ChessComClient
from .lichess_client import LichessClient


class SyncService:
    def __init__(self):
        self.chesscom = ChessComClient()
        self.lichess = LichessClient()

    async def sync_all(self, username: str, status: dict) -> int:
        db = SessionLocal()
        try:
            total = 0

            # Sync Chess.com
            status["message"] = "Fetching Chess.com games..."
            try:
                chesscom_games = await self.chesscom.fetch_games(username)
                inserted = self._insert_games(db, chesscom_games)
                total += inserted
                status["games_fetched"] = total
                status["message"] = f"Chess.com: {inserted} new games"
            except Exception as e:
                status["message"] = f"Chess.com error: {e}. Trying Lichess..."

            # Sync Lichess
            status["message"] = f"Fetching Lichess games... ({total} so far)"
            try:
                lichess_games = await self.lichess.fetch_games(username)
                inserted = self._insert_games(db, lichess_games)
                total += inserted
                status["games_fetched"] = total
            except Exception as e:
                status["message"] = f"Lichess error: {e}"

            # Update sync state
            for platform in ("chesscom", "lichess"):
                state = db.query(SyncState).filter(SyncState.platform == platform).first()
                if not state:
                    state = SyncState(platform=platform)
                    db.add(state)
                state.last_synced_at = datetime.utcnow()
            db.commit()

            return total
        finally:
            db.close()

    def _insert_games(self, db: Session, games: list[dict]) -> int:
        inserted = 0
        for g in games:
            game_id = f"{g['platform']}_{g['platform_id']}"
            existing = db.query(Game).filter(Game.id == game_id).first()
            if existing:
                continue

            game = Game(id=game_id, **g)
            db.add(game)
            inserted += 1

        db.commit()
        return inserted
