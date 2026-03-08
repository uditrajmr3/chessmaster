from datetime import datetime

from pydantic import BaseModel


class SyncRequest(BaseModel):
    username: str


class SyncStatus(BaseModel):
    status: str  # idle/syncing/done/error
    games_fetched: int = 0
    message: str = ""


class GameSummary(BaseModel):
    id: str
    platform: str
    player_color: str
    time_class: str
    result: str
    result_detail: str | None
    player_rating: int
    opponent_rating: int
    opponent_name: str
    opening_eco: str | None
    opening_name: str | None
    num_moves: int
    played_at: datetime
    platform_accuracy: float | None
    is_analyzed: bool = False

    class Config:
        from_attributes = True


class MoveAnalysisOut(BaseModel):
    move_number: int
    is_player_move: bool
    fen_before: str
    move_uci: str
    move_san: str
    eval_before: float | None
    eval_after: float | None
    best_move_uci: str | None
    best_move_san: str | None
    centipawn_loss: float
    classification: str
    game_phase: str
    time_remaining: float | None
    tactical_motifs: list[str] | None

    class Config:
        from_attributes = True


class GameDetail(BaseModel):
    id: str
    platform: str
    pgn: str
    player_color: str
    time_class: str
    result: str
    player_rating: int
    opponent_rating: int
    opponent_name: str
    opening_eco: str | None
    opening_name: str | None
    played_at: datetime
    moves: list[MoveAnalysisOut] = []

    class Config:
        from_attributes = True


class AnalyzeStatus(BaseModel):
    status: str
    total: int = 0
    completed: int = 0
    current_game: str | None = None


class RatingEstimate(BaseModel):
    platform: str
    time_class: str
    current_rating: int
    fide_estimate: int


class OverviewStats(BaseModel):
    total_games: int
    wins: int
    losses: int
    draws: int
    platforms: dict[str, int]
    avg_accuracy: float | None
    rating_history: list[dict]
    rating_estimates: list[RatingEstimate] = []


class OpeningNode(BaseModel):
    eco: str
    name: str
    games: int
    wins: int
    losses: int
    draws: int
    avg_cpl: float | None


class PatternReport(BaseModel):
    opening_stats: list[OpeningNode]
    worst_openings: list[OpeningNode]
    phase_accuracy: dict[str, float]
    phase_blunder_rate: dict[str, float]
    missed_tactics: dict[str, int]
    blunder_rate_normal: float
    blunder_rate_time_trouble: float
    white_stats: dict[str, float]
    black_stats: dict[str, float]
    endgame_conversion_rate: float
    blunder_by_move_bucket: dict[str, float]
    example_positions: list[dict]


class ReportOut(BaseModel):
    id: int
    generated_at: datetime
    games_count: int
    report_text: str
    report_json: dict

    class Config:
        from_attributes = True


class PuzzleOut(BaseModel):
    id: int
    move_analysis_id: int
    fen: str
    best_move_uci: str
    best_move_san: str
    player_move_san: str
    centipawn_loss: float
    game_phase: str
    tactical_motifs: list[str]
    game_id: str
    opponent: str
    played_at: datetime | None
    attempts: int
    successes: int


class PuzzleSubmit(BaseModel):
    move_uci: str


class PuzzleResult(BaseModel):
    correct: bool
    best_move_uci: str
    best_move_san: str
    player_move_san: str
    centipawn_loss: float


class PuzzleStats(BaseModel):
    total_puzzles: int
    attempted: int
    mastered: int  # success rate >= 80% and attempts >= 3
    due_for_review: int
    accuracy: float  # overall success rate
    by_phase: dict[str, int]  # puzzle count by game phase
    by_motif: dict[str, int]  # puzzle count by tactical motif
