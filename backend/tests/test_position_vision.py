"""Vision-based position reading.

Regression coverage for a real production bug: when Claude's response had no
text block at all (e.g. adaptive thinking consumed the whole max_tokens
budget before writing the JSON answer), `next(gen)` with no default raised a
bare StopIteration inside this async function — which asyncio surfaces as
`RuntimeError: coroutine raised StopIteration` rather than anything
catchable by the router's `except PositionReadError`. These tests exercise
that no-text-block path directly so it can't regress silently.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.position_vision import PositionReadError, read_position_from_image

VALID_FEN_JSON = json.dumps(
    {
        "fen_position": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
        "side_to_move": "w",
        "confidence": "high",
        "notes": "",
    }
)


def _mock_response(*, stop_reason="end_turn", content=None):
    response = MagicMock()
    response.stop_reason = stop_reason
    response.content = content if content is not None else []
    return response


def _patch_client(response):
    client_mock = MagicMock()
    client_mock.messages.create = AsyncMock(return_value=response)
    return patch("app.services.position_vision.anthropic.AsyncAnthropic", return_value=client_mock)


@pytest.mark.asyncio
async def test_happy_path_returns_fen():
    text_block = MagicMock(type="text", text=VALID_FEN_JSON)
    response = _mock_response(content=[text_block])

    with _patch_client(response):
        result = await read_position_from_image(b"fake-image-bytes", "image/png", "sk-ant-fake")

    assert result["fen"].startswith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w")
    assert result["confidence"] == "high"


@pytest.mark.asyncio
async def test_refusal_raises_position_read_error():
    response = _mock_response(stop_reason="refusal", content=[])
    with _patch_client(response):
        with pytest.raises(PositionReadError):
            await read_position_from_image(b"fake-image-bytes", "image/png", "sk-ant-fake")


@pytest.mark.asyncio
async def test_no_text_block_from_max_tokens_raises_clean_error_not_stop_iteration():
    """The exact bug: thinking-only response (no text block), stop_reason
    max_tokens. Must raise PositionReadError, never a bare StopIteration."""
    thinking_block = MagicMock(type="thinking", thinking="reasoning about squares...")
    response = _mock_response(stop_reason="max_tokens", content=[thinking_block])

    with _patch_client(response):
        with pytest.raises(PositionReadError, match="ran out of room"):
            await read_position_from_image(b"fake-image-bytes", "image/png", "sk-ant-fake")


@pytest.mark.asyncio
async def test_no_text_block_other_reason_raises_clean_error():
    response = _mock_response(stop_reason="end_turn", content=[])
    with _patch_client(response):
        with pytest.raises(PositionReadError, match="didn't return a readable position"):
            await read_position_from_image(b"fake-image-bytes", "image/png", "sk-ant-fake")


@pytest.mark.asyncio
async def test_unsupported_media_type_rejected_before_any_api_call():
    with pytest.raises(PositionReadError, match="Unsupported image type"):
        await read_position_from_image(b"fake-bytes", "image/bmp", "sk-ant-fake")


@pytest.mark.asyncio
async def test_illegal_position_raises_position_read_error():
    illegal_json = json.dumps(
        {
            "fen_position": "8/8/8/8/8/8/8/8",  # no kings at all
            "side_to_move": "w",
            "confidence": "low",
            "notes": "board was mostly empty",
        }
    )
    text_block = MagicMock(type="text", text=illegal_json)
    response = _mock_response(content=[text_block])

    with _patch_client(response):
        with pytest.raises(PositionReadError, match="doesn't look like a legal position"):
            await read_position_from_image(b"fake-image-bytes", "image/png", "sk-ant-fake")
