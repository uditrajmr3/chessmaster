import base64
import json
import logging

import anthropic
import chess

from ..config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a chess vision assistant. You are shown a photo or \
screenshot of a chess position (a physical board, an app, or a diagram). \
The board may be shown from White's perspective (rank 8 at top) or Black's \
perspective (rank 1 at top, files running right-to-left) — read any rank/file \
labels printed on the image itself rather than assuming a default orientation.

Identify each piece by its silhouette, not by guessing the "likely" piece for \
a square. Queens and rooks are the most commonly confused pair in stylized or \
icon-style sets — a queen's top has a crown with points or small balls; a \
rook's top is flat and crenellated (castle-like), with no crown. Look at the \
top silhouette of every tall piece individually before deciding; do not assume \
a piece is a queen just because it's near the center or looks important.

Before finalizing, count each side's pieces by type. A side should normally \
have exactly one king, one queen, two rooks, two bishops, two knights, and up \
to eight pawns — extra queens or missing rooks are much more often a misread \
than a real promotion. If your count looks unusual, re-examine those specific \
pieces before answering, and mention anything you're still unsure about in \
`notes`.

Two checks come before anything else:

1. Locate both kings first. Every legal position has exactly one white king \
and exactly one black king. A king's crown is topped with a cross; a queen's \
crown has points or balls and no cross. If you can't find one king of each \
colour, you have misread a square — look again before answering.

2. On a board drawn from Black's perspective, the rank nearest the bottom \
edge is rank 8 and the rank nearest the top edge is rank 1. Read those two \
edge ranks last and check them twice — pieces there are the ones most often \
dropped.

Read the position and report it precisely. If part of the board is unclear, \
make your best reading and say so in `notes` rather than refusing."""

FEN_SCHEMA = {
    "type": "object",
    "properties": {
        "fen_position": {
            "type": "string",
            "description": (
                "Just the piece-placement field of FEN (ranks 8 to 1, "
                "separated by '/', e.g. 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'). "
                "No side-to-move, castling, or move-count fields."
            ),
        },
        "side_to_move": {
            "type": "string",
            "enum": ["w", "b"],
            "description": "Best guess of whose turn it is from any visible UI cues (clock, highlight, arrow). Default 'w' if there's no indication.",
        },
        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
        "notes": {
            "type": "string",
            "description": "Anything ambiguous, occluded, or uncertain about the reading. Empty string if none.",
        },
    },
    "required": ["fen_position", "side_to_move", "confidence", "notes"],
    "additionalProperties": False,
}

_ALLOWED_MEDIA_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


class PositionReadError(ValueError):
    pass


# chess.Board.is_valid() is a single bool covering ~14 distinct defects. Naming
# the actual one matters twice over: the user gets a message that's true, and
# the repair turn below gets something concrete to re-examine.
_STATUS_DEFECTS = [
    (chess.STATUS_NO_WHITE_KING, "White's king is missing"),
    (chess.STATUS_NO_BLACK_KING, "Black's king is missing"),
    (chess.STATUS_TOO_MANY_KINGS, "a side has more than one king"),
    (chess.STATUS_TOO_MANY_WHITE_PAWNS, "White has more than eight pawns"),
    (chess.STATUS_TOO_MANY_BLACK_PAWNS, "Black has more than eight pawns"),
    (chess.STATUS_PAWNS_ON_BACKRANK, "a pawn is sitting on the first or eighth rank"),
    (chess.STATUS_TOO_MANY_WHITE_PIECES, "White has more than sixteen pieces"),
    (chess.STATUS_TOO_MANY_BLACK_PIECES, "Black has more than sixteen pieces"),
    (chess.STATUS_OPPOSITE_CHECK, "the side that just moved is left in check"),
    (chess.STATUS_TOO_MANY_CHECKERS, "too many pieces give check at once"),
    (chess.STATUS_IMPOSSIBLE_CHECK, "the checks can't be reached by a legal move"),
    (chess.STATUS_EMPTY, "the board is empty"),
]

_BOTH_KINGS_MISSING = chess.STATUS_NO_WHITE_KING | chess.STATUS_NO_BLACK_KING


def _describe_status(status: int) -> str:
    if status & _BOTH_KINGS_MISSING == _BOTH_KINGS_MISSING:
        defects = ["neither side has a king"]
        status &= ~_BOTH_KINGS_MISSING
    else:
        defects = []
    defects += [text for flag, text in _STATUS_DEFECTS if status & flag]
    if not defects:
        return "the position isn't reachable in a legal game"
    if len(defects) == 1:
        return defects[0]
    return f"{', '.join(defects[:-1])} and {defects[-1]}"


def _validate(parsed: dict) -> tuple[str | None, str | None]:
    """Return (fen, None) for a usable reading, or (None, defect) for a bad one."""
    fen = f"{parsed['fen_position']} {parsed['side_to_move']} - - 0 1"
    try:
        # chess.Board() only rejects malformed FEN *syntax* — a syntactically
        # valid but semantically illegal position (no kings, too many kings,
        # etc.) parses fine and needs the separate status() check.
        board = chess.Board(fen)
    except ValueError:
        return None, "the piece layout wasn't valid FEN"

    status = int(board.status())
    if status == chess.STATUS_VALID:
        return fen, None

    # side_to_move is an explicit guess (see FEN_SCHEMA), and guessing it wrong
    # is the one way a perfectly-read board fails validation. Flip it rather
    # than throwing away a good reading of the pieces.
    if status == chess.STATUS_OPPOSITE_CHECK:
        flipped = "b" if parsed["side_to_move"] == "w" else "w"
        candidate = f"{parsed['fen_position']} {flipped} - - 0 1"
        if chess.Board(candidate).is_valid():
            return candidate, None

    return None, _describe_status(status)


def _extract_text(response) -> str:
    if response.stop_reason == "refusal":
        raise PositionReadError(
            "Claude couldn't process that image. Try a clearer photo or screenshot."
        )

    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is not None:
        return text
    if response.stop_reason == "max_tokens":
        raise PositionReadError(
            "That position took longer to read than expected and ran out of "
            "room before finishing — try again, or use a clearer/cropped photo."
        )
    raise PositionReadError(
        "Claude didn't return a readable position for that image. Try again "
        "or use a clearer photo."
    )


# One initial read plus one repair turn. The misreads this catches (a dropped
# king on a flipped board, most often) are stochastic rather than systematic,
# and naming the defect back to the model recovers the read reliably.
_MAX_ATTEMPTS = 2


async def read_position_from_image(
    image_bytes: bytes, media_type: str, api_key: str
) -> dict:
    """Ask Claude to read a chess position from an image and return a FEN.

    Raises PositionReadError if the media type is unsupported or the
    resulting position isn't a legal chess.Board (missing/duplicate kings,
    malformed ranks, etc.) — the caller should surface this to the user
    rather than silently trusting a bad read.
    """
    if media_type not in _ALLOWED_MEDIA_TYPES:
        raise PositionReadError(
            f"Unsupported image type '{media_type}'. Use PNG, JPEG, WEBP, or GIF."
        )

    client = anthropic.AsyncAnthropic(api_key=api_key)
    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_data,
                    },
                },
                {
                    "type": "text",
                    "text": "Read the chess position in this image and report it.",
                },
            ],
        }
    ]

    defect = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        response = await client.messages.create(
            model=settings.position_analyzer_model,
            # Adaptive thinking can spend a fair amount of its budget reasoning
            # through square-mapping (especially on a flipped/Black-perspective
            # board) before ever writing the JSON answer. 2048 was tight enough
            # that thinking alone could exhaust it, leaving no text block at all.
            max_tokens=8192,
            system=SYSTEM_PROMPT,
            thinking={"type": "adaptive"},
            output_config={"format": {"type": "json_schema", "schema": FEN_SCHEMA}},
            messages=messages,
        )

        text = _extract_text(response)
        parsed = json.loads(text)
        fen, defect = _validate(parsed)
        if fen is not None:
            return {
                "fen": fen,
                "confidence": parsed["confidence"],
                "notes": parsed["notes"],
            }

        # Without this the rejected reading is discarded, and a production
        # failure leaves nothing behind to diagnose it with.
        logger.warning(
            "Position read rejected (attempt %d/%d): %s | fen=%r notes=%r",
            attempt,
            _MAX_ATTEMPTS,
            defect,
            parsed.get("fen_position"),
            parsed.get("notes"),
        )

        if attempt < _MAX_ATTEMPTS:
            messages = messages + [
                {"role": "assistant", "content": text},
                {
                    "role": "user",
                    "content": (
                        f"That position is illegal: {defect}. Re-examine the "
                        "board square by square — read the rank and file labels "
                        "off the image, and locate both kings before anything "
                        "else — then report a corrected position."
                    ),
                },
            ]

    raise PositionReadError(
        f"That doesn't look like a legal position ({defect}) — try a clearer "
        "photo, or set up the position manually."
    )
