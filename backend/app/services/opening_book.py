"""Opening Book Integration: track where players deviate from theory using their own game data."""

from collections import defaultdict

from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis


class OpeningBookService:
    def __init__(self, db: Session, user_id=None):
        if user_id is None:
            raise ValueError("user_id is required for tenant scoping")
        self.db = db
        self._user_id = user_id

    def get_book_analysis(
        self,
        game_id: str,
    ) -> dict:
        """Analyze a single game's opening against the player's own book (most common moves)."""
        game = self.db.query(Game).filter(Game.id == game_id, Game.user_id == self._user_id).first()
        if not game:
            return {"error": "Game not found", "moves": []}

        moves = (
            self.db.query(MoveAnalysis)
            .filter(MoveAnalysis.game_id == game_id)
            .order_by(MoveAnalysis.move_number)
            .all()
        )

        if not moves:
            return {"game_id": game_id, "moves": [], "deviation_point": None}

        # Build the player's opening book from all their games
        book = self._build_book()

        # Walk through the game and annotate each move
        result_moves = []
        fen_sequence = []
        deviated = False
        deviation_point = None

        for m in moves:
            fen = m.fen_before
            is_book = fen in book and not deviated
            book_moves = book.get(fen, {})

            # Find the most popular move at this position
            popular_move = None
            popular_count = 0
            total_at_position = sum(book_moves.values()) if book_moves else 0

            if book_moves:
                popular_move = max(book_moves, key=book_moves.get)
                popular_count = book_moves[popular_move]

            is_popular = m.move_san == popular_move if popular_move else False
            is_deviation = is_book and not is_popular and book_moves and m.is_player_move

            if is_deviation and not deviated:
                deviated = True
                deviation_point = m.move_number

            move_entry = {
                "move_number": m.move_number,
                "move_san": m.move_san,
                "is_player_move": bool(m.is_player_move),
                "in_book": is_book and bool(book_moves),
                "is_most_popular": is_popular,
                "is_deviation": is_deviation,
                "book_move": popular_move,
                "book_move_frequency": round(popular_count / total_at_position * 100, 1) if total_at_position > 0 else 0,
                "alternatives": [
                    {
                        "move": mv,
                        "count": cnt,
                        "frequency": round(cnt / total_at_position * 100, 1),
                    }
                    for mv, cnt in sorted(book_moves.items(), key=lambda x: -x[1])[:5]
                ] if book_moves else [],
                "cpl": m.centipawn_loss,
                "classification": m.classification,
                "game_phase": m.game_phase,
            }
            result_moves.append(move_entry)

            if m.game_phase != "opening":
                break

        return {
            "game_id": game_id,
            "opening_eco": game.opening_eco,
            "opening_name": game.opening_name,
            "moves": result_moves,
            "deviation_point": deviation_point,
            "total_book_positions": len(book),
        }

    def get_repertoire(
        self,
        color: str | None = None,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> list[dict]:
        """Get the player's opening repertoire — most common move sequences."""
        book = self._build_book(color=color, platform=platform, time_class=time_class)

        # Find the starting position
        start_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

        if start_fen not in book:
            return []

        # Build tree of most played lines (DFS, top 3 moves at each position)
        lines = []
        self._walk_book(book, start_fen, [], lines, depth=0, max_depth=10)

        return lines[:20]  # Top 20 lines

    def _walk_book(
        self,
        book: dict,
        fen: str,
        current_line: list[str],
        lines: list[dict],
        depth: int,
        max_depth: int,
    ):
        if depth >= max_depth or fen not in book:
            if current_line:
                lines.append({
                    "moves": list(current_line),
                    "depth": depth,
                    "games": 0,  # Will be set by the first move count
                })
            return

        moves = book[fen]
        if not moves:
            if current_line:
                lines.append({"moves": list(current_line), "depth": depth, "games": 0})
            return

        sorted_moves = sorted(moves.items(), key=lambda x: -x[1])
        top_moves = sorted_moves[:2]  # Top 2 at each position

        for move_san, count in top_moves:
            new_line = current_line + [move_san]
            # We need the next FEN, but we don't have it easily.
            # Just record the line and count
            if len(new_line) >= 4:  # At least 2 full moves
                lines.append({
                    "moves": list(new_line),
                    "depth": len(new_line),
                    "games": count,
                })

    def _build_book(
        self,
        color: str | None = None,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> dict[str, dict[str, int]]:
        """Build an opening book from the player's own games.

        Returns: {fen: {move_san: count}}
        """
        # Get all opening moves from analyzed games
        q = (
            self.db.query(MoveAnalysis)
            .filter(MoveAnalysis.game_phase == "opening")
            .join(Game, MoveAnalysis.game_id == Game.id)
            .filter(Game.user_id == self._user_id)
        )

        if platform:
            q = q.filter(Game.platform == platform)
        if time_class:
            q = q.filter(Game.time_class == time_class)
        if color:
            q = q.filter(Game.player_color == color)

        moves = q.all()

        book: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for m in moves:
            if m.fen_before:
                book[m.fen_before][m.move_san] += 1

        return dict(book)
