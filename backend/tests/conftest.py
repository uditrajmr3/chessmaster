"""Shared test fixtures: in-memory SQLite DB, FastAPI test client, sample data factories."""

import json
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import AnalysisJob, Game, MoveAnalysis, PuzzleProgress, Report, SyncState

# ── In-memory SQLite engine (single shared connection via StaticPool) ────────

TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=TEST_ENGINE, autoflush=False, autocommit=False)


@pytest.fixture()
def db():
    """Yield a fresh DB session with all tables created, torn down after each test."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture()
def client(db):
    """FastAPI TestClient wired to the in-memory DB."""

    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Factory helpers ──────────────────────────────────────────────────────────

def make_game(
    db,
    *,
    id="chesscom_test1",
    platform="chesscom",
    platform_id="test1",
    result="win",
    player_color="white",
    opening_eco="B12",
    opening_name="Caro-Kann Defense",
    player_rating=1500,
    opponent_rating=1480,
    time_class="rapid",
    played_at=None,
    platform_accuracy=None,
) -> Game:
    g = Game(
        id=id,
        platform=platform,
        platform_id=platform_id,
        pgn='[Event "Test"]\\n1. e4 c6 *',
        white_username="csense2653" if player_color == "white" else "opponent",
        black_username="opponent" if player_color == "white" else "csense2653",
        player_color=player_color,
        time_class=time_class,
        time_control="600",
        result=result,
        result_detail="resign" if result == "win" else "checkmated" if result == "loss" else "draw",
        player_rating=player_rating,
        opponent_rating=opponent_rating,
        opening_eco=opening_eco,
        opening_name=opening_name,
        num_moves=30,
        played_at=played_at or datetime(2025, 6, 15, 12, 0),
        platform_accuracy=platform_accuracy,
    )
    db.add(g)
    db.commit()
    return g


def make_move_analysis(
    db,
    *,
    game_id="chesscom_test1",
    move_number=0,
    is_player_move=1,
    classification="good",
    centipawn_loss=5.0,
    game_phase="opening",
    eval_before=50.0,
    eval_after=45.0,
    time_remaining=300.0,
    tactical_motifs=None,
) -> MoveAnalysis:
    m = MoveAnalysis(
        game_id=game_id,
        move_number=move_number,
        is_player_move=is_player_move,
        fen_before="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        move_uci="e2e4",
        move_san="e4",
        eval_before=eval_before,
        eval_after=eval_after,
        best_move_uci="e2e4",
        best_move_san="e4",
        centipawn_loss=centipawn_loss,
        classification=classification,
        game_phase=game_phase,
        time_remaining=time_remaining,
        tactical_motifs=json.dumps(tactical_motifs) if tactical_motifs else None,
    )
    db.add(m)
    db.commit()
    return m


def make_blunder(
    db,
    *,
    game_id="chesscom_test1",
    move_number=0,
    centipawn_loss=200.0,
    game_phase="middlegame",
    best_move_uci="d2d4",
    best_move_san="d4",
    move_uci="e2e4",
    move_san="e4",
    tactical_motifs=None,
) -> MoveAnalysis:
    """Create a blunder move analysis (convenience wrapper)."""
    m = MoveAnalysis(
        game_id=game_id,
        move_number=move_number,
        is_player_move=1,
        fen_before="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        move_uci=move_uci,
        move_san=move_san,
        eval_before=150.0,
        eval_after=-50.0,
        best_move_uci=best_move_uci,
        best_move_san=best_move_san,
        centipawn_loss=centipawn_loss,
        classification="blunder",
        game_phase=game_phase,
        time_remaining=300.0,
        tactical_motifs=json.dumps(tactical_motifs) if tactical_motifs else None,
    )
    db.add(m)
    db.commit()
    return m
