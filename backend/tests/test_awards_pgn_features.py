import pathlib
import pytest
from app.services.awards.pgn_features import extract_features

FIX = pathlib.Path(__file__).parent / "fixtures" / "awards"

def read(name: str) -> str:
    return (FIX / name).read_text()

def test_queen_mate_attributed_to_queen():
    f = extract_features(read("mate_by_queen.pgn"), "alice")
    assert f.result == "win"
    assert f.player_color == "white"
    assert f.mating_piece == "queen"
    assert f.opponent_username == "bob"

def test_knight_mate_attributed_to_knight():
    assert extract_features(read("mate_by_knight.pgn"), "alice").mating_piece == "knight"

def test_player_colour_resolved_from_headers():
    f = extract_features(read("mate_black_wins.pgn"), "bob")
    assert f.player_color == "black"
    assert f.result == "win"
    assert f.mating_piece == "queen"

def test_losing_side_gets_loss_and_no_mating_piece_credit():
    f = extract_features(read("mate_black_wins.pgn"), "alice")
    assert f.result == "loss"

def test_final_clock_parsed_in_milliseconds():
    f = extract_features(read("win_low_clock.pgn"), "alice")
    assert f.final_clock_ms == 800

def test_daily_game_without_clocks_yields_none_not_zero():
    f = extract_features(read("mate_by_queen.pgn"), "alice")
    assert f.final_clock_ms is None

def test_flawless_win_loses_no_pieces():
    assert extract_features(read("mate_by_queen.pgn"), "alice").pieces_lost == 0

def test_malformed_pgn_returns_none_rather_than_raising():
    assert extract_features(read("malformed.pgn"), "alice") is None

def test_username_matching_is_case_insensitive():
    assert extract_features(read("mate_by_queen.pgn"), "ALICE").player_color == "white"
