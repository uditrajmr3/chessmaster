export interface GameSummary {
  id: string;
  platform: string;
  player_color: string;
  time_class: string;
  result: string;
  result_detail: string | null;
  player_rating: number;
  opponent_rating: number;
  opponent_name: string;
  opening_eco: string | null;
  opening_name: string | null;
  num_moves: number;
  played_at: string;
  platform_accuracy: number | null;
  is_analyzed: boolean;
}

export interface MoveAnalysis {
  move_number: number;
  is_player_move: boolean;
  fen_before: string;
  move_uci: string;
  move_san: string;
  eval_before: number | null;
  eval_after: number | null;
  best_move_uci: string | null;
  best_move_san: string | null;
  centipawn_loss: number;
  classification: string;
  game_phase: string;
  time_remaining: number | null;
  tactical_motifs: string[] | null;
}

export interface GameDetail {
  id: string;
  platform: string;
  pgn: string;
  player_color: string;
  time_class: string;
  result: string;
  player_rating: number;
  opponent_rating: number;
  opponent_name: string;
  opening_eco: string | null;
  opening_name: string | null;
  played_at: string;
  moves: MoveAnalysis[];
}

export interface SyncStatus {
  status: string;
  games_fetched: number;
  message: string;
}

export interface AnalyzeStatus {
  status: string;
  total: number;
  completed: number;
  current_game: string | null;
}

export interface RatingEstimate {
  platform: string;
  time_class: string;
  current_rating: number;
  fide_estimate: number;
}

export interface OverviewStats {
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  platforms: Record<string, number>;
  avg_accuracy: number | null;
  rating_history: Array<{
    date: string;
    rating: number;
    platform: string;
    time_class: string;
  }>;
  rating_estimates: RatingEstimate[];
}

export interface OpeningNode {
  eco: string;
  name: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  avg_cpl: number | null;
}

export interface PatternReport {
  opening_stats: OpeningNode[];
  worst_openings: OpeningNode[];
  phase_accuracy: Record<string, number>;
  phase_blunder_rate: Record<string, number>;
  missed_tactics: Record<string, number>;
  blunder_rate_normal: number;
  blunder_rate_time_trouble: number;
  white_stats: Record<string, number>;
  black_stats: Record<string, number>;
  endgame_conversion_rate: number;
  blunder_by_move_bucket: Record<string, number>;
  example_positions: Array<{
    game_id: string;
    fen: string;
    player_move: string;
    best_move: string;
    centipawn_loss: number;
    game_phase: string;
    tactical_motifs: string[];
    opponent: string;
    date: string;
  }>;
}

export interface ReportData {
  id: number;
  generated_at: string;
  games_count: number;
  report_text: string;
  report_json: Record<string, unknown>;
}

export interface Puzzle {
  id: number;
  move_analysis_id: number;
  fen: string;
  best_move_uci: string;
  best_move_san: string;
  player_move_san: string;
  centipawn_loss: number;
  game_phase: string;
  tactical_motifs: string[];
  game_id: string;
  opponent: string;
  played_at: string | null;
  attempts: number;
  successes: number;
}

export interface PuzzleResult {
  correct: boolean;
  best_move_uci: string;
  best_move_san: string;
  player_move_san: string;
  centipawn_loss: number;
}

export interface PuzzleStats {
  total_puzzles: number;
  attempted: number;
  mastered: number;
  due_for_review: number;
  accuracy: number;
  by_phase: Record<string, number>;
  by_motif: Record<string, number>;
}

export interface TimeTroubleZone {
  moves: number;
  blunder_rate: number;
  avg_cpl: number;
}

export interface TimeVsMove {
  move: number;
  avg_time: number;
  avg_cpl: number;
  sample_size: number;
}

export interface TimeClassBreakdown {
  time_class: string;
  games: number;
  moves_analyzed: number;
  avg_cpl: number;
  time_trouble_pct: number;
}

export interface OverthinkMove {
  game_id: string;
  move_number: number;
  move_san: string;
  time_spent: number;
  cpl: number;
  phase: string;
}

export interface UnderthinkBlunder {
  game_id: string;
  move_number: number;
  move_san: string;
  best_move_san: string | null;
  time_spent: number;
  cpl: number;
  phase: string;
  opponent: string;
}

export interface TimeManagementProfile {
  time_per_move_by_phase: Record<string, number>;
  time_vs_move_number: TimeVsMove[];
  time_trouble_stats: Record<string, TimeTroubleZone>;
  overthink_moves: OverthinkMove[];
  underthink_blunders: UnderthinkBlunder[];
  avg_time_by_classification: Record<string, number>;
  time_class_breakdown: TimeClassBreakdown[];
  games_with_clock_data: number;
}

export interface StreakStats {
  max_win_streak: number;
  max_loss_streak: number;
  avg_win_streak: number;
  avg_loss_streak: number;
  total_win_streaks: number;
  total_loss_streaks: number;
}

export interface StreakBlunderData {
  blunder_rate: number;
  games: number;
  total_moves: number;
  blunders: number;
}

export interface SessionGame {
  game_number: number;
  result: string;
  rating: number;
  blunder_rate: number;
  cumulative_losses: number;
}

export interface SessionSummary {
  date: string;
  game_count: number;
  wins: number;
  losses: number;
  rating_change: number;
  games: SessionGame[];
}

export interface RatingDrop {
  date: string;
  games_in_session: number;
  rating_drop: number;
  peak_rating: number;
  low_rating: number;
  losses: number;
}

export interface TiltReport {
  streaks: StreakStats;
  blunder_by_losing_streak: Record<string, StreakBlunderData>;
  sessions: SessionSummary[];
  rating_drops: RatingDrop[];
  recommendations: string[];
}
