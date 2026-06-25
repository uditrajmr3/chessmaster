import uuid
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

    async def sync_all(
        self,
        user_id,
        lichess_username: str | None,
        chesscom_username: str | None,
        status: dict,
    ) -> int:
        db = SessionLocal()
        try:
            total = 0

            # Sync Chess.com (only if username is linked)
            if chesscom_username:
                status["message"] = "Fetching Chess.com games..."
                try:
                    chesscom_games = await self.chesscom.fetch_games(chesscom_username)
                    inserted = self._insert_games(db, user_id, chesscom_games)
                    total += inserted
                    status["games_fetched"] = total
                    status["message"] = f"Chess.com: {inserted} new games"
                except Exception as e:
                    status["message"] = f"Chess.com error: {e}. Trying Lichess..."

            # Sync Lichess (only if username is linked)
            if lichess_username:
                status["message"] = f"Fetching Lichess games... ({total} so far)"
                try:
                    lichess_games = await self.lichess.fetch_games(lichess_username)
                    inserted = self._insert_games(db, user_id, lichess_games)
                    total += inserted
                    status["games_fetched"] = total
                except Exception as e:
                    status["message"] = f"Lichess error: {e}"

            # Update sync state keyed by (user_id, platform)
            platforms = []
            if chesscom_username:
                platforms.append("chesscom")
            if lichess_username:
                platforms.append("lichess")

            for platform in platforms:
                state = (
                    db.query(SyncState)
                    .filter_by(user_id=user_id, platform=platform)
                    .first()
                )
                if not state:
                    state = SyncState(user_id=user_id, platform=platform)
                    db.add(state)
                state.last_synced_at = datetime.utcnow()
            db.commit()

            return total
        finally:
            db.close()

    def _insert_games(self, db: Session, user_id, games: list[dict]) -> int:
        inserted = 0
        for g in games:
            existing = (
                db.query(Game)
                .filter_by(
                    user_id=user_id,
                    platform=g["platform"],
                    platform_id=g["platform_id"],
                )
                .first()
            )
            if existing:
                continue

            game = Game(id=str(uuid.uuid4()), user_id=user_id, **g)
            db.add(game)
            inserted += 1

        db.commit()
        return inserted
