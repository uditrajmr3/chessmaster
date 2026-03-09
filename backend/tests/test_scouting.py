"""Tests for Pre-Game Opponent Scouting feature."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

from app.services.scouting_service import ScoutingService

from .conftest import make_game


def _opp_game(
    eco="B20",
    name="Sicilian Defense",
    color="black",
    result="win",
    time_class="blitz",
    rating=1500,
    played_at=None,
):
    """Build a minimal opponent game dict matching client output format."""
    return {
        "platform": "chesscom",
        "platform_id": f"g_{eco}_{result}",
        "pgn": "",
        "white_username": "opponent" if color == "black" else "me",
        "black_username": "me" if color == "black" else "opponent",
        "player_color": color,
        "time_class": time_class,
        "time_control": "300",
        "result": result,
        "result_detail": result,
        "player_rating": rating,
        "opponent_rating": 1400,
        "opening_eco": eco,
        "opening_name": name,
        "num_moves": 30,
        "played_at": played_at or datetime(2025, 6, 15, 12, 0),
        "platform_accuracy": None,
    }


class TestBuildProfile:
    def test_basic_profile(self, db):
        service = ScoutingService(db)
        games = [
            _opp_game(color="white", result="win"),
            _opp_game(color="white", result="loss"),
            _opp_game(color="black", result="win"),
            _opp_game(color="black", result="loss"),
        ]
        profile = service._build_profile(games, "opponent", "chesscom")
        assert profile["username"] == "opponent"
        assert profile["games_analyzed"] == 4
        assert profile["white_win_rate"] == 50.0
        assert profile["black_win_rate"] == 50.0

    def test_rating_from_most_recent(self, db):
        service = ScoutingService(db)
        games = [
            _opp_game(rating=1600, played_at=datetime(2025, 6, 20)),
            _opp_game(rating=1500, played_at=datetime(2025, 6, 10)),
        ]
        profile = service._build_profile(games, "opp", "chesscom")
        assert profile["rating"] == 1600

    def test_favorite_time_class(self, db):
        service = ScoutingService(db)
        games = [
            _opp_game(time_class="blitz"),
            _opp_game(time_class="blitz"),
            _opp_game(time_class="rapid"),
        ]
        profile = service._build_profile(games, "opp", "chesscom")
        assert profile["favorite_time_class"] == "blitz"


class TestOpeningBreakdown:
    def test_groups_by_eco(self, db):
        service = ScoutingService(db)
        games = [
            _opp_game(eco="B20", name="Sicilian", color="black", result="win"),
            _opp_game(eco="B20", name="Sicilian", color="black", result="loss"),
            _opp_game(eco="C50", name="Italian", color="black", result="win"),
        ]
        breakdown = service._opening_breakdown(games, "black")
        assert len(breakdown) == 2
        assert breakdown[0]["eco"] == "B20"
        assert breakdown[0]["games"] == 2
        assert breakdown[0]["wins"] == 1
        assert breakdown[0]["losses"] == 1
        assert breakdown[0]["frequency_pct"] == pytest.approx(66.7, abs=0.1)

    def test_filters_by_color(self, db):
        service = ScoutingService(db)
        games = [
            _opp_game(eco="B20", color="white"),
            _opp_game(eco="C50", color="black"),
        ]
        white_bd = service._opening_breakdown(games, "white")
        black_bd = service._opening_breakdown(games, "black")
        assert len(white_bd) == 1
        assert white_bd[0]["eco"] == "B20"
        assert len(black_bd) == 1
        assert black_bd[0]["eco"] == "C50"


class TestCrossReference:
    def test_matches_user_games(self, db):
        # User has games with B20 opening
        make_game(db, id="ug1", platform_id="ug1", opening_eco="B20", result="win")
        make_game(db, id="ug2", platform_id="ug2", opening_eco="B20", result="loss")
        make_game(db, id="ug3", platform_id="ug3", opening_eco="B20", result="win")

        service = ScoutingService(db)
        opp_openings = [{"eco": "B20", "name": "Sicilian", "frequency_pct": 60.0}]
        xref = service._cross_reference(opp_openings)

        assert len(xref) == 1
        assert xref[0]["eco"] == "B20"
        assert xref[0]["your_games"] == 3
        assert xref[0]["your_win_rate"] == pytest.approx(66.7, abs=0.1)

    def test_no_matching_games(self, db):
        service = ScoutingService(db)
        opp_openings = [{"eco": "A00", "name": "Unknown", "frequency_pct": 100.0}]
        xref = service._cross_reference(opp_openings)

        assert len(xref) == 1
        assert xref[0]["your_games"] == 0
        assert xref[0]["your_win_rate"] is None


class TestRecommendations:
    def test_suggests_alternative_for_weak_opening(self, db):
        # User struggles against Sicilian (B20)
        for i in range(5):
            make_game(db, id=f"ug{i}", platform_id=f"ug{i}", opening_eco="B20",
                      result="loss" if i < 4 else "win")

        service = ScoutingService(db)
        black_openings = [{"eco": "B20", "name": "Sicilian", "games": 8,
                           "wins": 5, "losses": 3, "draws": 0, "frequency_pct": 50.0}]
        cross_ref = {
            "your_record_vs_their_black_openings": service._cross_reference(black_openings),
            "your_record_vs_their_white_openings": [],
        }
        profile = {"white_win_rate": 50, "black_win_rate": 50}

        recs = service._generate_recommendations([], black_openings, cross_ref, profile)
        assert any("1.d4" in r for r in recs)

    def test_highlights_user_strength(self, db):
        # User is good against C50
        for i in range(5):
            make_game(db, id=f"ug{i}", platform_id=f"ug{i}", opening_eco="C50",
                      result="win" if i < 4 else "loss")

        service = ScoutingService(db)
        black_openings = [{"eco": "C50", "name": "Italian", "games": 6,
                           "wins": 3, "losses": 3, "draws": 0, "frequency_pct": 40.0}]
        cross_ref = {
            "your_record_vs_their_black_openings": service._cross_reference(black_openings),
            "your_record_vs_their_white_openings": [],
        }
        profile = {"white_win_rate": 50, "black_win_rate": 50}

        recs = service._generate_recommendations([], black_openings, cross_ref, profile)
        assert any("perform well" in r or "80.0%" in r for r in recs)

    def test_color_strength_recommendation(self, db):
        service = ScoutingService(db)
        profile = {"white_win_rate": 70, "black_win_rate": 45}
        recs = service._generate_recommendations([], [], {
            "your_record_vs_their_black_openings": [],
            "your_record_vs_their_white_openings": [],
        }, profile)
        assert any("stronger as white" in r for r in recs)

    def test_describes_opponent_tendencies(self, db):
        service = ScoutingService(db)
        profile = {"white_win_rate": 50, "black_win_rate": 50}
        black_openings = [{"eco": "B20", "name": "Sicilian", "games": 8,
                           "wins": 4, "losses": 4, "draws": 0, "frequency_pct": 40.0}]
        recs = service._generate_recommendations([], black_openings, {
            "your_record_vs_their_black_openings": [],
            "your_record_vs_their_white_openings": [],
        }, profile)
        assert any("Sicilian" in r for r in recs)

    def test_warns_about_unknown_openings(self, db):
        service = ScoutingService(db)
        profile = {"white_win_rate": 50, "black_win_rate": 50}
        black_openings = [{"eco": "A45", "name": "Indian Game", "games": 5,
                           "wins": 3, "losses": 2, "draws": 0, "frequency_pct": 30.0}]
        cross_ref = {
            "your_record_vs_their_black_openings": [
                {"eco": "A45", "name": "Indian Game", "opponent_plays_pct": 30.0,
                 "your_games": 0, "your_win_rate": None}
            ],
            "your_record_vs_their_white_openings": [],
        }
        recs = service._generate_recommendations([], black_openings, cross_ref, profile)
        assert any("no experience" in r.lower() for r in recs)

    def test_highlights_opponent_weak_opening(self, db):
        service = ScoutingService(db)
        profile = {"white_win_rate": 50, "black_win_rate": 50}
        white_openings = [{"eco": "C50", "name": "Italian", "games": 5,
                           "wins": 1, "losses": 4, "draws": 0, "frequency_pct": 30.0}]
        recs = service._generate_recommendations(white_openings, [], {
            "your_record_vs_their_black_openings": [],
            "your_record_vs_their_white_openings": [],
        }, profile)
        assert any("struggles" in r.lower() for r in recs)


class TestEmptyReport:
    def test_empty_report_structure(self, db):
        service = ScoutingService(db)
        report = service._empty_report("nobody", "chesscom")
        assert report["opponent"]["games_analyzed"] == 0
        assert report["opponent_white_openings"] == []
        assert report["opponent_black_openings"] == []
        assert len(report["recommendations"]) == 1


class TestScoutingAPI:
    def test_invalid_platform(self, client):
        resp = client.post("/api/scouting/scout", json={
            "opponent_username": "test",
            "platform": "invalid",
        })
        assert resp.status_code == 422

    @patch("app.services.scouting_service.ChessComClient.fetch_recent_games")
    def test_scout_returns_report(self, mock_fetch, client, db):
        # Create user games
        make_game(db, id="ug1", platform_id="ug1", opening_eco="B20", result="win")
        make_game(db, id="ug2", platform_id="ug2", opening_eco="B20", result="loss")

        mock_fetch.return_value = [
            _opp_game(eco="B20", name="Sicilian", color="black", result="win"),
            _opp_game(eco="B20", name="Sicilian", color="black", result="win"),
            _opp_game(eco="C50", name="Italian", color="white", result="win"),
        ]

        resp = client.post("/api/scouting/scout", json={
            "opponent_username": "testplayer",
            "platform": "chesscom",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["opponent"]["username"] == "testplayer"
        assert data["opponent"]["games_analyzed"] == 3
        assert len(data["opponent_black_openings"]) > 0
        assert len(data["cross_reference"]["your_record_vs_their_black_openings"]) > 0
        assert len(data["recommendations"]) > 0

    @patch("app.services.scouting_service.ChessComClient.fetch_recent_games")
    def test_scout_empty_opponent(self, mock_fetch, client):
        mock_fetch.return_value = []

        resp = client.post("/api/scouting/scout", json={
            "opponent_username": "nobody",
            "platform": "chesscom",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["opponent"]["games_analyzed"] == 0
        assert "No games found" in data["recommendations"][0]


import pytest
