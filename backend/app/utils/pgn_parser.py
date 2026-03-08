import io
import re

import chess.pgn


def parse_pgn(pgn_str: str) -> chess.pgn.Game | None:
    """Parse a PGN string into a python-chess Game object."""
    try:
        game = chess.pgn.read_game(io.StringIO(pgn_str))
        return game
    except Exception:
        return None


def extract_clocks(pgn_str: str) -> list[float]:
    """Extract clock times from PGN comments like {[%clk 0:09:54.3]}."""
    pattern = r'\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]'
    matches = re.findall(pattern, pgn_str)
    clocks = []
    for h, m, s in matches:
        total = int(h) * 3600 + int(m) * 60 + float(s)
        clocks.append(total)
    return clocks
