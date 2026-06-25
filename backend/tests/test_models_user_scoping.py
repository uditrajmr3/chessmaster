"""Tests verifying user_id scoping is present on all data tables."""

from app.models import AnalysisJob, Game, PuzzleProgress, Report, SyncState


def test_all_data_tables_have_user_id():
    for m in (Game, AnalysisJob, Report, PuzzleProgress, SyncState):
        assert "user_id" in m.__table__.columns.keys(), m.__name__


def test_game_unique_per_user_platform():
    names = {tuple(c.name for c in uc.columns) for uc in Game.__table__.constraints
             if hasattr(uc, "columns")}
    assert any({"user_id", "platform", "platform_id"} <= set(n) for n in names)
