import base64
import json

import anthropic
import chess

from ..config import settings

SYSTEM_PROMPT = """You are a chess vision assistant. You are shown a photo or \
screenshot of a chess position (a physical board, an app, or a diagram). \
The board may be shown from White's perspective (rank 8 at top) or Black's \
perspective (rank 1 at top, files running right-to-left) — read any rank/file \
labels printed on the image itself rather than assuming a default orientation. \
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
        messages=[
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
        ],
    )

    if response.stop_reason == "refusal":
        raise PositionReadError(
            "Claude couldn't process that image. Try a clearer photo or screenshot."
        )

    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is None:
        if response.stop_reason == "max_tokens":
            raise PositionReadError(
                "That position took longer to read than expected and ran out of "
                "room before finishing — try again, or use a clearer/cropped photo."
            )
        raise PositionReadError(
            "Claude didn't return a readable position for that image. Try again "
            "or use a clearer photo."
        )
    parsed = json.loads(text)

    fen = f"{parsed['fen_position']} {parsed['side_to_move']} - - 0 1"
    try:
        # chess.Board() only rejects malformed FEN *syntax* — a syntactically
        # valid but semantically illegal position (no kings, too many kings,
        # etc.) parses fine and needs the separate is_valid() check.
        board = chess.Board(fen)
    except ValueError as e:
        raise PositionReadError(
            "Couldn't read a valid position from that image — try a clearer or "
            "more tightly cropped photo, or set up the position manually."
        ) from e
    if not board.is_valid():
        raise PositionReadError(
            "That doesn't look like a legal position (check for missing or "
            "extra kings) — try a clearer photo, or set up the position manually."
        )

    return {
        "fen": fen,
        "confidence": parsed["confidence"],
        "notes": parsed["notes"],
    }
