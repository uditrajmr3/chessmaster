"""Tests for database models: creation, constraints, relationships."""

import json
from datetime import datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import AnalysisJob, Game, MoveAnalysis, Report, SyncState
from tests.conftest import make_game, make_move_analysis


class TestGameModel:
    def test_create_game(self, db):
        game = make_game(db)
        assert game.id == "chesscom_test1"
        assert game.platform == "chesscom"
        assert game.result == "win"

    def test_unique_platform_id_constraint(self, db):
        make_game(db, id="g1", platform_id="same_id", platform="chesscom")
        with pytest.raises(IntegrityError):
            make_game(db, id="g2", platform_id="same_id", platform="chesscom")

    def test_same_platform_id_different_platforms_ok(self, db):
        """Same platform_id on different platforms should be fine."""
        make_game(db, id="cc1", platform_id="same_id", platform="chesscom")
        make_game(db, id="li1", platform_id="same_id", platform="lichess")
        games = db.query(Game).all()
        assert len(games) == 2

    def test_query_by_time_class(self, db):
        make_game(db, id="r1", platform_id="r1", time_class="rapid")
        make_game(db, id="c1", platform_id="c1", time_class="classical")
        rapid = db.query(Game).filter(Game.time_class == "rapid").all()
        assert len(rapid) == 1

    def test_query_by_opening(self, db):
        make_game(db, id="g1", platform_id="g1", opening_eco="B12")
        make_game(db, id="g2", platform_id="g2", opening_eco="C50")
        results = db.query(Game).filter(Game.opening_eco == "B12").all()
        assert len(results) == 1


class TestMoveAnalysisModel:
    def test_create_move_analysis(self, db):
        make_game(db)
        m = make_move_analysis(db)
        assert m.game_id == "chesscom_test1"
        assert m.classification == "good"

    def test_unique_game_move_constraint(self, db):
        make_game(db)
        make_move_analysis(db, move_number=0)
        with pytest.raises(IntegrityError):
            make_move_analysis(db, move_number=0)

    def test_tactical_motifs_json(self, db):
        make_game(db)
        m = make_move_analysis(db, tactical_motifs=["fork", "pin"])
        loaded = json.loads(m.tactical_motifs)
        assert loaded == ["fork", "pin"]

    def test_multiple_moves_same_game(self, db):
        make_game(db)
        for i in range(5):
            make_move_analysis(db, move_number=i)
        moves = db.query(MoveAnalysis).filter(MoveAnalysis.game_id == "chesscom_test1").all()
        assert len(moves) == 5


class TestAnalysisJobModel:
    def test_create_job(self, db):
        make_game(db)
        job = AnalysisJob(game_id="chesscom_test1", status="pending")
        db.add(job)
        db.commit()
        assert job.status == "pending"

    def test_unique_game_id(self, db):
        make_game(db)
        db.add(AnalysisJob(game_id="chesscom_test1", status="pending"))
        db.commit()
        with pytest.raises(IntegrityError):
            db.add(AnalysisJob(game_id="chesscom_test1", status="running"))
            db.commit()

    def test_status_transitions(self, db):
        make_game(db)
        job = AnalysisJob(game_id="chesscom_test1", status="pending")
        db.add(job)
        db.commit()

        job.status = "running"
        job.started_at = datetime.utcnow()
        db.commit()
        assert job.status == "running"

        job.status = "completed"
        job.completed_at = datetime.utcnow()
        db.commit()
        assert job.status == "completed"


class TestSyncStateModel:
    def test_create_sync_state(self, db):
        state = SyncState(platform="chesscom")
        db.add(state)
        db.commit()
        assert state.platform == "chesscom"

    def test_update_sync_state(self, db):
        state = SyncState(platform="lichess", last_synced_at=datetime(2025, 1, 1))
        db.add(state)
        db.commit()
        state.last_synced_at = datetime(2025, 6, 1)
        db.commit()

        loaded = db.query(SyncState).filter(SyncState.platform == "lichess").first()
        assert loaded.last_synced_at.year == 2025
        assert loaded.last_synced_at.month == 6


class TestReportModel:
    def test_create_report(self, db):
        report = Report(
            games_count=50,
            report_json='{"test": true}',
            report_text="Your main weakness is ...",
        )
        db.add(report)
        db.commit()
        assert report.id is not None
        assert report.games_count == 50

    def test_report_auto_timestamp(self, db):
        report = Report(
            games_count=10,
            report_json="{}",
            report_text="Test report",
        )
        db.add(report)
        db.commit()
        assert report.generated_at is not None
