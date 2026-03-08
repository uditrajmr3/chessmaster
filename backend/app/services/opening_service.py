from collections import defaultdict

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis


class OpeningService:
    def __init__(self, db: Session):
        self.db = db

    def get_tree(self) -> list[dict]:
        """Build a personal opening tree with stats per ECO code."""
        games = self.db.query(Game).filter(Game.opening_eco.isnot(None)).all()
        tree: dict[str, dict] = defaultdict(
            lambda: {"eco": "", "name": "", "games": 0, "wins": 0, "losses": 0, "draws": 0}
        )

        for g in games:
            key = g.opening_eco
            node = tree[key]
            node["eco"] = g.opening_eco
            node["name"] = g.opening_name or g.opening_eco
            node["games"] += 1
            if g.result == "win":
                node["wins"] += 1
            elif g.result == "loss":
                node["losses"] += 1
            else:
                node["draws"] += 1

        # Calculate avg CPL per opening
        for eco, node in tree.items():
            game_ids = [g.id for g in games if g.opening_eco == eco]
            avg_cpl = (
                self.db.query(func.avg(MoveAnalysis.centipawn_loss))
                .filter(
                    MoveAnalysis.game_id.in_(game_ids),
                    MoveAnalysis.is_player_move == 1,
                )
                .scalar()
            )
            node["avg_cpl"] = round(float(avg_cpl), 1) if avg_cpl else None

        result = sorted(tree.values(), key=lambda x: x["games"], reverse=True)
        return result
