"""Parse one Chess.com PGN into a compact feature record.

Each game is parsed exactly once; every measurement is derived from the
aggregate of these records. Re-walking move lists per award would be
quadratic in the number of awards.
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

import chess
import chess.pgn

_CLK = re.compile(r"\[%clk\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)\]")

_PIECE_NAMES = {
    chess.PAWN: "pawn", chess.KNIGHT: "knight", chess.BISHOP: "bishop",
    chess.ROOK: "rook", chess.QUEEN: "queen", chess.KING: "king",
}


@dataclass
class GameFeature:
    rules: str = "chess"
    time_class: str = "unknown"
    result: str = "draw"                  # win | loss | draw
    player_color: str = "white"
    opponent_username: str = ""
    mating_piece: str | None = None       # checking piece on the final position
    mate_by_king_discovery: bool = False
    mate_by_castling: bool = False
    final_clock_ms: int | None = None
    moves: int = 0
    pieces_lost: int = 0
    eco: str | None = None
    promotions: dict[str, int] = field(default_factory=dict)
    player_rating: int | None = None


def _clock_ms(comment: str) -> int | None:
    m = _CLK.search(comment or "")
    if not m:
        return None
    h, mi, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return int((h * 3600 + mi * 60 + s) * 1000)


def extract_features(pgn_text: str, player: str) -> GameFeature | None:
    try:
        game = chess.pgn.read_game(io.StringIO(pgn_text))
    except Exception:
        return None
    if game is None:
        return None

    h = game.headers
    white, black = (h.get("White") or "").lower(), (h.get("Black") or "").lower()
    p = player.lower()
    if p not in (white, black):
        return None

    f = GameFeature()
    f.player_color = "white" if p == white else "black"
    player_is_white = f.player_color == "white"
    f.opponent_username = h.get("Black") if player_is_white else h.get("White")
    f.eco = h.get("ECO") or None
    f.rules = (h.get("Variant") or "chess").lower().replace(" ", "")

    res = h.get("Result", "*")
    if res == "1/2-1/2":
        f.result = "draw"
    elif res in ("1-0", "0-1"):
        won = (res == "1-0") == player_is_white
        f.result = "win" if won else "loss"

    rating_key = "WhiteElo" if player_is_white else "BlackElo"
    try:
        f.player_rating = int(h.get(rating_key, ""))
    except (TypeError, ValueError):
        f.player_rating = None

    player_color = chess.WHITE if player_is_white else chess.BLACK
    board = game.board()
    last_move = None
    last_clock = None

    for node in game.mainline():
        move = node.move
        mover = board.turn
        if board.is_capture(move) and mover != player_color:
            f.pieces_lost += 1
        if move.promotion and mover == player_color:
            name = _PIECE_NAMES[move.promotion]
            f.promotions[name] = f.promotions.get(name, 0) + 1
        if mover == player_color:
            c = _clock_ms(node.comment)
            if c is not None:
                last_clock = c
        was_castling = board.is_castling(move)
        board.push(move)
        last_move, f.moves = move, f.moves + 1
        if board.is_checkmate() and mover == player_color:
            f.mate_by_castling = was_castling

    f.final_clock_ms = last_clock

    # Mate attribution: the checking piece, not the piece that moved.
    if board.is_checkmate() and f.result == "win":
        checkers = list(board.checkers())
        if len(checkers) == 1:
            sq = checkers[0]
            piece = board.piece_at(sq)
            if piece is not None:
                f.mating_piece = _PIECE_NAMES[piece.piece_type]
            # A king cannot give direct check, so a king that moved while not
            # being a checker revealed a discovered mate.
            if last_move is not None and sq != last_move.to_square:
                moved = board.piece_at(last_move.to_square)
                if moved is not None and moved.piece_type == chess.KING:
                    f.mate_by_king_discovery = True
        elif len(checkers) > 1 and last_move is not None:
            moved = board.piece_at(last_move.to_square)
            if moved is not None:
                f.mating_piece = _PIECE_NAMES[moved.piece_type]

    return f
