from collections import defaultdict

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis


class TimeManagementService:
    def __init__(self, db: Session):
        self.db = db
        self._platform: str | None = None
        self._time_class: str | None = None

    def _filtered_game_ids(self) -> list[str] | None:
        """Return game IDs matching platform/time_class filters, or None if no filters."""
        if not self._platform and not self._time_class:
            return None
        q = self.db.query(Game.id)
        if self._platform:
            q = q.filter(Game.platform == self._platform)
        if self._time_class:
            q = q.filter(Game.time_class == self._time_class)
        return [gid for (gid,) in q.all()]

    def _apply_move_filter(self, query):
        """Apply game-level filters to a MoveAnalysis query."""
        game_ids = self._filtered_game_ids()
        if game_ids is not None:
            return query.filter(MoveAnalysis.game_id.in_(game_ids))
        return query

    def get_profile(
        self,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> dict:
        self._platform = platform
        self._time_class = time_class
        """Build a complete time management profile from analyzed games."""
        return {
            "time_per_move_by_phase": self._time_per_move_by_phase(),
            "time_vs_move_number": self._time_vs_move_number(),
            "time_trouble_stats": self._time_trouble_stats(),
            "overthink_moves": self._overthink_moves(),
            "underthink_blunders": self._underthink_blunders(),
            "avg_time_by_classification": self._avg_time_by_classification(),
            "time_class_breakdown": self._time_class_breakdown(),
            "games_with_clock_data": self._games_with_clock_data(),
        }

    def _games_with_clock_data(self) -> int:
        """Count analyzed games that have clock data."""
        q = self.db.query(func.count(func.distinct(MoveAnalysis.game_id))).filter(
            MoveAnalysis.is_player_move == 1,
            MoveAnalysis.time_remaining.isnot(None),
        )
        return self._apply_move_filter(q).scalar() or 0

    def _time_per_move_by_phase(self) -> dict[str, float]:
        """Average time spent per move in each game phase."""
        result = {}
        for phase in ("opening", "middlegame", "endgame"):
            q = self.db.query(MoveAnalysis.time_remaining, MoveAnalysis.move_number, MoveAnalysis.game_id).filter(
                MoveAnalysis.is_player_move == 1,
                MoveAnalysis.time_remaining.isnot(None),
                MoveAnalysis.game_phase == phase,
            )
            rows = self._apply_move_filter(q).order_by(MoveAnalysis.game_id, MoveAnalysis.move_number).all()
            time_spent = self._compute_time_spent(rows)
            result[phase] = round(sum(time_spent) / len(time_spent), 1) if time_spent else 0.0
        return result

    def _time_vs_move_number(self) -> list[dict]:
        """Average time spent per move number bucket (player moves only)."""
        q = self.db.query(
            MoveAnalysis.move_number,
            MoveAnalysis.time_remaining,
            MoveAnalysis.game_id,
            MoveAnalysis.centipawn_loss,
        ).filter(
            MoveAnalysis.is_player_move == 1,
            MoveAnalysis.time_remaining.isnot(None),
        )
        rows = self._apply_move_filter(q).order_by(MoveAnalysis.game_id, MoveAnalysis.move_number).all()

        # Group by game to compute time spent per move
        games: dict[str, list[tuple]] = defaultdict(list)
        for move_num, time_rem, game_id, cpl in rows:
            games[game_id].append((move_num, time_rem, cpl))

        # Bucket by move number (convert ply to move number)
        bucket_times: dict[int, list[float]] = defaultdict(list)
        bucket_cpl: dict[int, list[float]] = defaultdict(list)

        for game_id, moves in games.items():
            moves.sort(key=lambda x: x[0])
            for i, (move_num, time_rem, cpl) in enumerate(moves):
                actual_move = move_num // 2 + 1
                if i == 0:
                    # First player move — can't compute time spent
                    continue
                prev_time = moves[i - 1][1]
                spent = max(0, prev_time - time_rem)
                # Cap at reasonable max (some increments can cause weird values)
                if spent < 300:
                    bucket_times[actual_move].append(spent)
                    bucket_cpl[actual_move].append(cpl)

        result = []
        for move_num in sorted(bucket_times.keys()):
            if move_num > 60:
                break
            times = bucket_times[move_num]
            cpls = bucket_cpl[move_num]
            result.append({
                "move": move_num,
                "avg_time": round(sum(times) / len(times), 1) if times else 0,
                "avg_cpl": round(sum(cpls) / len(cpls), 1) if cpls else 0,
                "sample_size": len(times),
            })
        return result

    def _time_trouble_stats(self) -> dict:
        """Detailed breakdown of behavior in time trouble vs normal."""
        thresholds = [
            ("critical", 0, 30),
            ("low", 30, 60),
            ("normal", 60, 180),
            ("comfortable", 180, 99999),
        ]
        result = {}
        for label, low, high in thresholds:
            q_total = self.db.query(func.count(MoveAnalysis.id)).filter(
                MoveAnalysis.is_player_move == 1,
                MoveAnalysis.time_remaining.isnot(None),
                MoveAnalysis.time_remaining >= low,
                MoveAnalysis.time_remaining < high,
            )
            total = self._apply_move_filter(q_total).scalar() or 0
            q_blunders = self.db.query(func.count(MoveAnalysis.id)).filter(
                MoveAnalysis.is_player_move == 1,
                MoveAnalysis.time_remaining.isnot(None),
                MoveAnalysis.time_remaining >= low,
                MoveAnalysis.time_remaining < high,
                MoveAnalysis.classification.in_(["blunder", "mistake"]),
            )
            blunders = self._apply_move_filter(q_blunders).scalar() or 0
            q_cpl = self.db.query(func.avg(MoveAnalysis.centipawn_loss)).filter(
                MoveAnalysis.is_player_move == 1,
                MoveAnalysis.time_remaining.isnot(None),
                MoveAnalysis.time_remaining >= low,
                MoveAnalysis.time_remaining < high,
            )
            avg_cpl = self._apply_move_filter(q_cpl).scalar()
            result[label] = {
                "moves": total,
                "blunder_rate": round(blunders / total * 100, 1) if total > 0 else 0,
                "avg_cpl": round(float(avg_cpl), 1) if avg_cpl else 0,
            }
        return result

    def _overthink_moves(self, limit: int = 10) -> list[dict]:
        """Moves where the player spent a lot of time on book/easy positions."""
        q = self.db.query(MoveAnalysis).filter(
            MoveAnalysis.is_player_move == 1,
            MoveAnalysis.time_remaining.isnot(None),
            MoveAnalysis.game_phase == "opening",
            MoveAnalysis.centipawn_loss <= 10,
        )
        rows = self._apply_move_filter(q).order_by(MoveAnalysis.game_id, MoveAnalysis.move_number).all()

        # Group by game, compute time spent
        games: dict[str, list] = defaultdict(list)
        for row in rows:
            games[row.game_id].append(row)

        # Get all player moves per game for time calculation
        all_player_moves = {}
        for game_id in games:
            all_moves = (
                self.db.query(MoveAnalysis)
                .filter(
                    MoveAnalysis.game_id == game_id,
                    MoveAnalysis.is_player_move == 1,
                    MoveAnalysis.time_remaining.isnot(None),
                )
                .order_by(MoveAnalysis.move_number)
                .all()
            )
            all_player_moves[game_id] = all_moves

        overthinks = []
        for game_id, opening_moves in games.items():
            all_moves = all_player_moves.get(game_id, [])
            if len(all_moves) < 2:
                continue
            for i, m in enumerate(all_moves):
                if m not in opening_moves:
                    continue
                if i == 0:
                    continue
                prev_time = all_moves[i - 1].time_remaining
                spent = prev_time - m.time_remaining
                if spent > 15:  # More than 15s on a book move
                    overthinks.append({
                        "game_id": m.game_id,
                        "move_number": m.move_number // 2 + 1,
                        "move_san": m.move_san,
                        "time_spent": round(spent, 1),
                        "cpl": m.centipawn_loss,
                        "phase": m.game_phase,
                    })

        overthinks.sort(key=lambda x: x["time_spent"], reverse=True)
        return overthinks[:limit]

    def _underthink_blunders(self, limit: int = 10) -> list[dict]:
        """Blunders where the player spent very little time (rushed)."""
        q = self.db.query(MoveAnalysis).filter(
            MoveAnalysis.is_player_move == 1,
            MoveAnalysis.time_remaining.isnot(None),
            MoveAnalysis.classification.in_(["blunder", "mistake"]),
            MoveAnalysis.centipawn_loss > 100,
        )
        rows = self._apply_move_filter(q).order_by(MoveAnalysis.game_id, MoveAnalysis.move_number).all()

        games: dict[str, list] = defaultdict(list)
        for row in rows:
            games[row.game_id].append(row)

        all_player_moves = {}
        for game_id in games:
            all_moves = (
                self.db.query(MoveAnalysis)
                .filter(
                    MoveAnalysis.game_id == game_id,
                    MoveAnalysis.is_player_move == 1,
                    MoveAnalysis.time_remaining.isnot(None),
                )
                .order_by(MoveAnalysis.move_number)
                .all()
            )
            all_player_moves[game_id] = all_moves

        underthinks = []
        for game_id, blunder_moves in games.items():
            all_moves = all_player_moves.get(game_id, [])
            if len(all_moves) < 2:
                continue
            for i, m in enumerate(all_moves):
                if m not in blunder_moves:
                    continue
                if i == 0:
                    continue
                prev_time = all_moves[i - 1].time_remaining
                spent = prev_time - m.time_remaining
                if 0 < spent < 5:  # Less than 5s on a blunder
                    game = self.db.query(Game).filter(Game.id == game_id).first()
                    underthinks.append({
                        "game_id": m.game_id,
                        "move_number": m.move_number // 2 + 1,
                        "move_san": m.move_san,
                        "best_move_san": m.best_move_san,
                        "time_spent": round(spent, 1),
                        "cpl": m.centipawn_loss,
                        "phase": m.game_phase,
                        "opponent": (game.black_username if game and game.player_color == "white"
                                     else (game.white_username if game else "")),
                    })

        underthinks.sort(key=lambda x: x["cpl"], reverse=True)
        return underthinks[:limit]

    def _avg_time_by_classification(self) -> dict[str, float]:
        """Average time spent on moves of each classification."""
        classifications = ["great", "good", "inaccuracy", "mistake", "blunder"]

        # Get all player moves with clock data, grouped by game
        q = self.db.query(
            MoveAnalysis.game_id,
            MoveAnalysis.move_number,
            MoveAnalysis.time_remaining,
            MoveAnalysis.classification,
        ).filter(
            MoveAnalysis.is_player_move == 1,
            MoveAnalysis.time_remaining.isnot(None),
        )
        rows = self._apply_move_filter(q).order_by(MoveAnalysis.game_id, MoveAnalysis.move_number).all()

        games: dict[str, list[tuple]] = defaultdict(list)
        for game_id, move_num, time_rem, classif in rows:
            games[game_id].append((move_num, time_rem, classif))

        class_times: dict[str, list[float]] = defaultdict(list)

        for game_id, moves in games.items():
            moves.sort(key=lambda x: x[0])
            for i in range(1, len(moves)):
                spent = max(0, moves[i - 1][1] - moves[i][1])
                if spent < 300:
                    class_times[moves[i][2]].append(spent)

        result = {}
        for c in classifications:
            times = class_times.get(c, [])
            result[c] = round(sum(times) / len(times), 1) if times else 0
        return result

    def _time_class_breakdown(self) -> list[dict]:
        """Stats broken down by time control (rapid, blitz, bullet)."""
        q = self.db.query(Game.time_class)
        if self._platform:
            q = q.filter(Game.platform == self._platform)
        if self._time_class:
            q = q.filter(Game.time_class == self._time_class)
        time_classes = q.distinct().all()

        result = []
        for (tc,) in time_classes:
            gq = self.db.query(Game.id).filter(Game.time_class == tc)
            if self._platform:
                gq = gq.filter(Game.platform == self._platform)
            game_ids = [g.id for g in gq.all()]
            if not game_ids:
                continue

            total_moves = (
                self.db.query(func.count(MoveAnalysis.id))
                .filter(
                    MoveAnalysis.game_id.in_(game_ids),
                    MoveAnalysis.is_player_move == 1,
                    MoveAnalysis.time_remaining.isnot(None),
                )
                .scalar()
                or 0
            )

            if total_moves == 0:
                continue

            avg_cpl = (
                self.db.query(func.avg(MoveAnalysis.centipawn_loss))
                .filter(
                    MoveAnalysis.game_id.in_(game_ids),
                    MoveAnalysis.is_player_move == 1,
                )
                .scalar()
            )

            time_trouble_moves = (
                self.db.query(func.count(MoveAnalysis.id))
                .filter(
                    MoveAnalysis.game_id.in_(game_ids),
                    MoveAnalysis.is_player_move == 1,
                    MoveAnalysis.time_remaining.isnot(None),
                    MoveAnalysis.time_remaining < 30,
                )
                .scalar()
                or 0
            )

            result.append({
                "time_class": tc,
                "games": len(game_ids),
                "moves_analyzed": total_moves,
                "avg_cpl": round(float(avg_cpl), 1) if avg_cpl else 0,
                "time_trouble_pct": round(time_trouble_moves / total_moves * 100, 1) if total_moves > 0 else 0,
            })

        result.sort(key=lambda x: x["games"], reverse=True)
        return result

    def _compute_time_spent(self, rows) -> list[float]:
        """Compute time spent per move from consecutive time_remaining values."""
        games: dict[str, list[tuple]] = defaultdict(list)
        for time_rem, move_num, game_id in rows:
            games[game_id].append((move_num, time_rem))

        spent_list = []
        for game_id, moves in games.items():
            moves.sort(key=lambda x: x[0])
            for i in range(1, len(moves)):
                spent = max(0, moves[i - 1][1] - moves[i][1])
                if spent < 300:  # Filter out increment artifacts
                    spent_list.append(spent)
        return spent_list
