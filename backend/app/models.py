from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from .database import Base


class Game(Base):
    __tablename__ = "games"

    id = Column(String, primary_key=True)  # "chesscom_{id}" or "lichess_{id}"
    platform = Column(String, nullable=False)
    platform_id = Column(String, nullable=False)
    pgn = Column(Text, nullable=False)
    white_username = Column(String, nullable=False)
    black_username = Column(String, nullable=False)
    player_color = Column(String, nullable=False)
    time_class = Column(String, nullable=False)
    time_control = Column(String, nullable=False)
    result = Column(String, nullable=False)  # win/loss/draw
    result_detail = Column(String)
    player_rating = Column(Integer, nullable=False)
    opponent_rating = Column(Integer, nullable=False)
    opening_eco = Column(String)
    opening_name = Column(String)
    num_moves = Column(Integer, nullable=False)
    played_at = Column(DateTime, nullable=False)
    platform_accuracy = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("platform", "platform_id"),
        Index("idx_games_played_at", "played_at"),
        Index("idx_games_opening", "opening_eco"),
        Index("idx_games_time_class", "time_class"),
    )


class MoveAnalysis(Base):
    __tablename__ = "move_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(String, nullable=False, index=True)
    move_number = Column(Integer, nullable=False)  # ply index
    is_player_move = Column(Integer, nullable=False)
    fen_before = Column(Text, nullable=False)
    move_uci = Column(String, nullable=False)
    move_san = Column(String, nullable=False)
    eval_before = Column(Float)
    eval_after = Column(Float)
    best_move_uci = Column(String)
    best_move_san = Column(String)
    centipawn_loss = Column(Float, nullable=False, default=0)
    classification = Column(String, nullable=False)
    game_phase = Column(String, nullable=False)
    time_remaining = Column(Float)
    tactical_motifs = Column(Text)  # JSON array

    __table_args__ = (UniqueConstraint("game_id", "move_number"),)


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(String, unique=True, nullable=False)
    status = Column(String, nullable=False, default="pending")
    engine_depth = Column(Integer, default=20)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error = Column(Text)


class SyncState(Base):
    __tablename__ = "sync_state"

    platform = Column(String, primary_key=True)
    last_synced_at = Column(DateTime)
    last_game_time = Column(DateTime)
    cached_archives = Column(Text)  # JSON list


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    games_count = Column(Integer, nullable=False)
    report_json = Column(Text, nullable=False)
    report_text = Column(Text, nullable=False)


class PuzzleProgress(Base):
    __tablename__ = "puzzle_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    move_analysis_id = Column(Integer, nullable=False, unique=True)  # FK to MoveAnalysis
    attempts = Column(Integer, nullable=False, default=0)
    successes = Column(Integer, nullable=False, default=0)
    last_seen = Column(DateTime)
    next_review = Column(DateTime)
    ease_factor = Column(Float, nullable=False, default=2.5)  # SM-2 ease factor
    interval_days = Column(Float, nullable=False, default=0)  # current interval in days
    created_at = Column(DateTime, default=datetime.utcnow)
