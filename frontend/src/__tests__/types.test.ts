/**
 * Type-level tests: verify that our TypeScript interfaces
 * correctly model the backend API responses.
 */

import type {
  GameSummary,
  GameDetail,
  MoveAnalysis,
  SyncStatus,
  AnalyzeStatus,
  OverviewStats,
  OpeningNode,
  PatternReport,
  ReportData,
} from "@/lib/types";

describe("TypeScript interfaces compile-time validation", () => {
  it("GameSummary matches backend schema", () => {
    const game: GameSummary = {
      id: "chesscom_abc",
      platform: "chesscom",
      player_color: "white",
      time_class: "rapid",
      result: "win",
      result_detail: "resign",
      player_rating: 1500,
      opponent_rating: 1480,
      opponent_name: "opponent",
      opening_eco: "B12",
      opening_name: "Caro-Kann Defense",
      num_moves: 42,
      played_at: "2025-06-15T12:00:00",
      platform_accuracy: 85.3,
      is_analyzed: true,
    };
    expect(game.id).toBe("chesscom_abc");
    expect(game.platform_accuracy).toBe(85.3);
  });

  it("GameSummary allows null optional fields", () => {
    const game: GameSummary = {
      id: "lichess_xyz",
      platform: "lichess",
      player_color: "black",
      time_class: "classical",
      result: "loss",
      result_detail: null,
      player_rating: 1600,
      opponent_rating: 1650,
      opponent_name: "magnus",
      opening_eco: null,
      opening_name: null,
      num_moves: 35,
      played_at: "2025-06-15T12:00:00",
      platform_accuracy: null,
      is_analyzed: false,
    };
    expect(game.result_detail).toBeNull();
    expect(game.opening_eco).toBeNull();
  });

  it("MoveAnalysis captures all fields", () => {
    const move: MoveAnalysis = {
      move_number: 0,
      is_player_move: true,
      fen_before: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      move_uci: "e2e4",
      move_san: "e4",
      eval_before: 30,
      eval_after: 25,
      best_move_uci: "e2e4",
      best_move_san: "e4",
      centipawn_loss: 5,
      classification: "good",
      game_phase: "opening",
      time_remaining: 590.0,
      tactical_motifs: null,
    };
    expect(move.classification).toBe("good");
  });

  it("MoveAnalysis with tactical motifs", () => {
    const move: MoveAnalysis = {
      move_number: 15,
      is_player_move: true,
      fen_before: "some_fen",
      move_uci: "d4d5",
      move_san: "d5",
      eval_before: 100,
      eval_after: -200,
      best_move_uci: "c3d5",
      best_move_san: "Nxd5",
      centipawn_loss: 300,
      classification: "blunder",
      game_phase: "middlegame",
      time_remaining: 45.0,
      tactical_motifs: ["fork", "pin"],
    };
    expect(move.tactical_motifs).toContain("fork");
    expect(move.centipawn_loss).toBe(300);
  });

  it("SyncStatus models all states", () => {
    const statuses: SyncStatus[] = [
      { status: "idle", games_fetched: 0, message: "" },
      { status: "syncing", games_fetched: 50, message: "Fetching Chess.com..." },
      { status: "done", games_fetched: 200, message: "Sync complete" },
      { status: "error", games_fetched: 0, message: "Connection failed" },
    ];
    expect(statuses).toHaveLength(4);
    expect(statuses[2].games_fetched).toBe(200);
  });

  it("PatternReport has all expected fields", () => {
    const report: PatternReport = {
      opening_stats: [],
      worst_openings: [],
      phase_accuracy: { opening: 15, middlegame: 25, endgame: 35 },
      phase_blunder_rate: { opening: 1, middlegame: 3, endgame: 5 },
      missed_tactics: { fork: 10, pin: 5, back_rank: 2 },
      blunder_rate_normal: 2.5,
      blunder_rate_time_trouble: 8.0,
      white_stats: { win_rate: 55, avg_cpl: 20, games: 100 },
      black_stats: { win_rate: 45, avg_cpl: 25, games: 90 },
      endgame_conversion_rate: 72.5,
      blunder_by_move_bucket: { "1-10": 1, "11-20": 3, "21-30": 5, "31-40": 4, "41+": 6 },
      example_positions: [
        {
          game_id: "g1",
          fen: "some_fen",
          player_move: "Qh4",
          best_move: "Nxe5",
          centipawn_loss: 350,
          game_phase: "middlegame",
          tactical_motifs: ["fork"],
          opponent: "opponent",
          date: "2025-06-15",
        },
      ],
    };
    expect(report.endgame_conversion_rate).toBe(72.5);
    expect(report.example_positions[0].centipawn_loss).toBe(350);
  });

  it("OverviewStats rating_history has expected shape", () => {
    const stats: OverviewStats = {
      total_games: 200,
      wins: 100,
      losses: 80,
      draws: 20,
      platforms: { chesscom: 120, lichess: 80 },
      avg_accuracy: 75.0,
      rating_history: [
        { date: "2025-01-01", rating: 1400, platform: "chesscom", time_class: "rapid" },
        { date: "2025-06-01", rating: 1550, platform: "chesscom", time_class: "rapid" },
      ],
    };
    expect(stats.rating_history).toHaveLength(2);
    expect(stats.rating_history[1].rating).toBe(1550);
  });
});
