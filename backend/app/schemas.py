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


class StreakStats(BaseModel):
    max_win_streak: int
    max_loss_streak: int
    avg_win_streak: float
    avg_loss_streak: float
    total_win_streaks: int
    total_loss_streaks: int


class StreakBlunderData(BaseModel):
    blunder_rate: float
    games: int
    total_moves: int
    blunders: int


class SessionGame(BaseModel):
    game_number: int
    result: str
    rating: int
    blunder_rate: float
    cumulative_losses: int


class SessionSummary(BaseModel):
    date: str
    game_count: int
    wins: int
    losses: int
    rating_change: int
    games: list[SessionGame]


class RatingDrop(BaseModel):
    date: str
    games_in_session: int
    rating_drop: int
    peak_rating: int
    low_rating: int
    losses: int


class TiltReport(BaseModel):
    streaks: StreakStats
    blunder_by_losing_streak: dict[str, StreakBlunderData]
    sessions: list[SessionSummary]
    rating_drops: list[RatingDrop]
    recommendations: list[str]


# ── Scouting ──

class ScoutRequest(BaseModel):
    opponent_username: str
    platform: str  # "chesscom" or "lichess"
    max_games: int = 100


class OpponentProfile(BaseModel):
    username: str
    platform: str
    games_analyzed: int
    rating: int
    white_win_rate: float
    black_win_rate: float
    favorite_time_class: str


class OpponentOpening(BaseModel):
    eco: str
    name: str
    games: int
    wins: int
    losses: int
    draws: int
    frequency_pct: float


class CrossReferenceEntry(BaseModel):
    eco: str
    name: str
    opponent_plays_pct: float
    your_games: int
    your_win_rate: float | None


class CrossReference(BaseModel):
    your_record_vs_their_white_openings: list[CrossReferenceEntry]
    your_record_vs_their_black_openings: list[CrossReferenceEntry]


class ScoutReport(BaseModel):
    opponent: OpponentProfile
    opponent_white_openings: list[OpponentOpening]
    opponent_black_openings: list[OpponentOpening]
    cross_reference: CrossReference
    recommendations: list[str]


# ── Endgame ──

class EndgameOverall(BaseModel):
    games_with_endgame: int
    avg_endgame_cpl: float


class EndgameTypeStats(BaseModel):
    type: str
    games: int
    had_advantage: int
    converted: int
    failed: int
    conversion_rate: float | None
    avg_cpl: float
    total_blunders: int


class EndgameFailure(BaseModel):
    game_id: str
    endgame_type: str
    result: str
    entering_eval: float
    avg_cpl: float
    blunders: int
    opponent: str
    played_at: str
    fen: str


class EndgameReport(BaseModel):
    overall: EndgameOverall
    by_type: list[EndgameTypeStats]
    worst_games: list[EndgameFailure]
    recommendations: list[str]


# ── Rating Predictor ──

class RatingTrajectory(BaseModel):
    current_rating: int
    starting_rating: int
    total_change: int
    days_tracked: int
    games_played: int
    rate_per_month: float
    recent_momentum: float
    peak_rating: int
    valley_rating: int
    recent_win_rate: float


class RatingMilestone(BaseModel):
    target_rating: int
    months_away: float
    projected_date: str


class MonthlyPerformance(BaseModel):
    month: str
    games: int
    wins: int
    losses: int
    draws: int
    win_rate: float
    avg_rating: int
    peak_rating: int
    rating_change: int


class CplTrend(BaseModel):
    month: str
    avg_cpl: float
    moves: int


class WeaknessTrends(BaseModel):
    opening_cpl: list[CplTrend]
    middlegame_cpl: list[CplTrend]
    endgame_cpl: list[CplTrend]


class RatingPredictionReport(BaseModel):
    trajectory: RatingTrajectory
    milestones: list[RatingMilestone]
    weakness_trends: WeaknessTrends
    monthly_performance: list[MonthlyPerformance]
    recommendations: list[str]


# ── Digest ──

class DigestSummary(BaseModel):
    total_games: int
    wins: int
    losses: int
    draws: int
    win_rate: float
    rating_start: int
    rating_end: int
    rating_change: int


class DigestAccuracy(BaseModel):
    avg_cpl: float
    blunders: int
    mistakes: int
    missed_tactics: int


class DigestOpening(BaseModel):
    eco: str
    name: str
    games: int
    wins: int
    losses: int


class DigestImprovement(BaseModel):
    has_comparison: bool
    win_rate_change: float = 0
    cpl_change: float = 0
    games_change: int = 0
    prev_win_rate: float = 0
    prev_avg_cpl: float = 0


class DigestHighlight(BaseModel):
    type: str
    game_id: str
    description: str


class DigestReport(BaseModel):
    period_days: int
    period_start: str
    period_end: str
    summary: DigestSummary
    openings: list[DigestOpening]
    accuracy: DigestAccuracy
    improvement: DigestImprovement
    highlights: list[DigestHighlight]
    digest_text: str


# ── Peer Comparison ──

class PeerMetric(BaseModel):
    metric: str
    your_value: float
    peer_average: float
    difference_pct: float
    suffix: str
    verdict: str


class PeerComparisonReport(BaseModel):
    rating_band: str
    avg_rating: int
    games_analyzed: int
    comparisons: list[PeerMetric]
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
