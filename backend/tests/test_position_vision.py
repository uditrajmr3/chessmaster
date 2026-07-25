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


def _json_response(payload):
    return _mock_response(content=[MagicMock(type="text", text=json.dumps(payload))])


def _patch_client(response):
    client_mock = MagicMock()
    client_mock.messages.create = AsyncMock(return_value=response)
    return patch("app.services.position_vision.anthropic.AsyncAnthropic", return_value=client_mock)


def _patch_client_sequence(responses):
    """Distinct response per call, so the repair turn can be exercised."""
    client_mock = MagicMock()
    client_mock.messages.create = AsyncMock(side_effect=responses)
    patcher = patch(
        "app.services.position_vision.anthropic.AsyncAnthropic", return_value=client_mock
    )
    return patcher, client_mock


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


# The production bug this file's repair loop exists for: reading a board drawn
# from Black's perspective, Claude intermittently dropped the black king off
# the bottom edge rank. Reproduced live at roughly 1 read in 3; naming the
# defect back to it recovered the correct position every time.
MISSING_BLACK_KING = {
    "fen_position": "8/pp6/2pnr2p/8/4pKR1/1P6/P1P2PP1/8",
    "side_to_move": "b",
    "confidence": "high",
    "notes": "No black king visible on the board.",
}
CORRECTED = {**MISSING_BLACK_KING, "fen_position": "5k2/pp6/2pnr2p/8/4pKR1/1P6/P1P2PP1/8"}


@pytest.mark.asyncio
async def test_illegal_first_read_is_repaired_on_a_second_pass():
    patcher, client_mock = _patch_client_sequence(
        [_json_response(MISSING_BLACK_KING), _json_response(CORRECTED)]
    )
    with patcher:
        result = await read_position_from_image(b"fake-image-bytes", "image/png", "sk-ant-fake")

    assert result["fen"].startswith(CORRECTED["fen_position"])
    assert client_mock.messages.create.await_count == 2

    # The repair turn must tell the model what was actually wrong, otherwise
    # it is just a re-roll of the same read.
    repair = client_mock.messages.create.await_args.kwargs["messages"][-1]
    assert repair["role"] == "user"
    assert "Black's king is missing" in repair["content"]


@pytest.mark.asyncio
async def test_persistent_illegal_position_reports_the_real_defect():
    """The old message blamed kings for every failure, including the many
    defects that have nothing to do with kings."""
    too_many_pawns = {
        "fen_position": "4k3/pppppppp/pppppppp/8/8/8/PPPPPPPP/4K3",
        "side_to_move": "w",
        "confidence": "low",
        "notes": "",
    }
    patcher, _ = _patch_client_sequence(
        [_json_response(too_many_pawns), _json_response(too_many_pawns)]
    )
    with patcher:
        with pytest.raises(PositionReadError, match="more than eight pawns"):
            await read_position_from_image(b"fake-image-bytes", "image/png", "sk-ant-fake")


@pytest.mark.asyncio
async def test_wrong_side_to_move_guess_does_not_reject_a_good_reading():
    """side_to_move is an explicit guess, so it must not be able to condemn an
    otherwise legal board: guessing 'w' when Black is in check is only an
    illegal position because of the guess."""
    wrong_guess = {
        "fen_position": "4k3/8/8/8/8/8/8/K3R3",
        "side_to_move": "w",
        "confidence": "medium",
        "notes": "",
    }
    patcher, client_mock = _patch_client_sequence([_json_response(wrong_guess)])
    with patcher:
        result = await read_position_from_image(b"fake-image-bytes", "image/png", "sk-ant-fake")

    assert result["fen"] == "4k3/8/8/8/8/8/8/K3R3 b - - 0 1"
    assert client_mock.messages.create.await_count == 1
