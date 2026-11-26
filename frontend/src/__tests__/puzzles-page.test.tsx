/**
 * Puzzles page: header strip, context line, hint ladder, result panel (verdict +
 * two-board replay, no CPL), and the renamed stat.
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/puzzles",
}));

jest.mock("@/components/TeachingBoard", () => ({
  __esModule: true,
  default: (p: {
    onPieceDrop?: (f: string, t: string, pt: string) => boolean;
    rings?: string[];
    dots?: string[];
    initialOrientation?: string;
  }) => (
    <div
      data-testid="teaching-board"
      data-rings={(p.rings ?? []).join(",")}
      data-dots={(p.dots ?? []).join(",")}
      data-orientation={p.initialOrientation}
    >
      <button onClick={() => p.onPieceDrop?.("d2", "d4", "wP")}>drop-d4</button>
    </div>
  ),
}));

// Replay boards: record the arrows they receive.
jest.mock("@/components/insight/MoveBoard", () => ({
  __esModule: true,
  default: (p: { arrows?: { from: string; to: string; tone: string }[]; ariaLabel: string }) => (
    <div
      data-testid="move-board"
      aria-label={p.ariaLabel}
      data-arrows={(p.arrows ?? []).map((a) => `${a.tone}:${a.from}${a.to}`).join(",")}
    />
  ),
}));

jest.mock("@/lib/api", () => ({
  api: {
    getNextPuzzle: jest.fn(),
    getPuzzleStats: jest.fn(),
    submitPuzzle: jest.fn(),
  },
}));

import PuzzlesPage from "@/app/(app)/puzzles/page";
import { api } from "@/lib/api";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const puzzle = {
  id: 7,
  move_analysis_id: 1,
  fen: START,
  best_move_uci: "d2d4",
  best_move_san: "d4",
  player_move_san: "e4",
  centipawn_loss: 312,
  game_phase: "opening",
  tactical_motifs: [],
  game_id: "g1",
  opponent: "Magnus",
  played_at: null,
  attempts: 0,
  successes: 0,
  player_move_uci: "e2e4",
  refutation_uci: "e7e5",
  eval_before: 50,
  eval_after: -250,
  move_number: 7,
  player_color: "white",
};

const stats = {
  total_puzzles: 10,
  attempted: 4,
  mastered: 1,
  due_for_review: 3,
  accuracy: 55,
  by_phase: { opening: 6, endgame: 4 },
  by_motif: { fork: 5, back_rank: 2 },
};

beforeEach(() => {
  window.localStorage.clear();
  (api.getNextPuzzle as jest.Mock).mockResolvedValue(puzzle);
  (api.getPuzzleStats as jest.Mock).mockResolvedValue(stats);
  (api.submitPuzzle as jest.Mock).mockReset();
});

describe("PuzzlesPage", () => {
  it("shows the title, due strip, context line and the renamed stat", async () => {
    render(<PuzzlesPage />);
    expect(await screen.findByText("Puzzles from your own games")).toBeInTheDocument();
    expect(await screen.findByText("3 puzzles are waiting for review today")).toBeInTheDocument();
    expect(screen.getByTestId("puzzle-context")).toHaveTextContent(
      "From your game vs Magnus. You are White. Find a better move than you played.",
    );
    expect(screen.getByText("Right answers")).toBeInTheDocument();
    expect(screen.queryByText("Accuracy")).not.toBeInTheDocument();
    expect(screen.queryByText(/Centipawn/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("teaching-board")).toHaveAttribute("data-orientation", "white");
  });

  it("walks the hint ladder: ring, dot, then offers the answer", async () => {
    render(<PuzzlesPage />);
    const board = await screen.findByTestId("teaching-board");
    expect(board).toHaveAttribute("data-rings", "");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(board).toHaveAttribute("data-rings", "d2");
    expect(board).toHaveAttribute("data-dots", "");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(board).toHaveAttribute("data-dots", "d4");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.queryByRole("button", { name: "Hint" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(api.submitPuzzle).not.toHaveBeenCalled();
    expect(await screen.findByTestId("puzzle-result")).toBeInTheDocument();
  });

  it("wrong answer: result panel has verdict, cost bucket, two replay boards, no CPL", async () => {
    (api.submitPuzzle as jest.Mock).mockResolvedValue({
      correct: false,
      best_move_uci: "d2d4",
      best_move_san: "d4",
      player_move_san: "d4",
      centipawn_loss: 312,
    });
    render(<PuzzlesPage />);
    await screen.findByTestId("teaching-board");
    fireEvent.click(screen.getByText("drop-d4"));
    const panel = await screen.findByTestId("puzzle-result");
    expect(panel).toHaveTextContent("Not quite. The better move was d4.");
    expect(panel).toHaveTextContent("What you played");
    expect(panel).toHaveTextContent("The better move");
    // Numbers stay behind the "Show numbers" toggle: nothing visible by default.
    const visible = panel.cloneNode(true) as HTMLElement;
    visible.querySelectorAll("[hidden]").forEach((n) => n.remove());
    expect(visible.textContent).not.toMatch(/CPL|centipawn/i);
    expect(screen.getByText("Centipawn loss")).not.toBeVisible();
    expect(screen.getByText("About a knight or bishop")).toBeInTheDocument();
    const boards = screen.getAllByTestId("move-board");
    expect(boards).toHaveLength(2);
    expect(boards[0]).toHaveAttribute("data-arrows", "bad:e2e4,threat:e7e5");
    expect(boards[1]).toHaveAttribute("data-arrows", "good:d2d4");
    expect(api.submitPuzzle).toHaveBeenCalledWith(7, "d2d4");
  });

  it("correct answer: congratulates and counts a streak", async () => {
    (api.submitPuzzle as jest.Mock).mockResolvedValue({
      correct: true,
      best_move_uci: "d2d4",
      best_move_san: "d4",
      player_move_san: "d4",
      centipawn_loss: 0,
    });
    render(<PuzzlesPage />);
    await screen.findByTestId("teaching-board");
    fireEvent.click(screen.getByText("drop-d4"));
    expect(await screen.findByText("Correct! You found a better move.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Streak: 1 in a row")).toBeInTheDocument());
  });

  it("lists progress by tactic with Practise links that deep-link", async () => {
    render(<PuzzlesPage />);
    const prog = await screen.findByTestId("puzzle-progress");
    const links = Array.from(prog.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain("/puzzles?motif=fork");
    expect(links).toContain("/puzzles?motif=back_rank");
    expect(links).toContain("/puzzles?phase=endgame");
  });

  it("shows the all-caught-up state when nothing is left", async () => {
    (api.getNextPuzzle as jest.Mock).mockResolvedValue(null);
    render(<PuzzlesPage />);
    expect(await screen.findByText("All caught up")).toBeInTheDocument();
  });
});
