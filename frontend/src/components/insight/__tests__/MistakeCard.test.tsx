import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import MistakeCard, { MistakeCardSkeleton, type MistakeCardMistake } from "../MistakeCard";

// Stand-in for the interactive board: buttons that fire drop / tap callbacks and
// expose the hint props, so no react-chessboard is needed in jsdom.
jest.mock("@/components/TeachingBoard", () => ({
  __esModule: true,
  default: (p: {
    onPieceDrop?: (f: string, t: string, pt: string) => boolean;
    onSquareClick?: (s: string) => void;
    rings?: string[];
    dots?: string[];
    arrows?: unknown[];
  }) => (
    <div data-testid="teaching-board" data-rings={(p.rings ?? []).join(",")} data-dots={(p.dots ?? []).join(",")} data-arrows={(p.arrows ?? []).length}>
      <button onClick={() => p.onPieceDrop?.("e2", "e4", "wP")}>drop-e4</button>
      <button onClick={() => p.onPieceDrop?.("d2", "d4", "wP")}>drop-d4</button>
      <button onClick={() => p.onSquareClick?.("d2")}>tap-d2</button>
      <button onClick={() => p.onSquareClick?.("d4")}>tap-d4</button>
    </div>
  ),
}));

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const base: MistakeCardMistake = {
  game_id: "g1",
  move_number: 7,
  opponent: "Magnus",
  date: "2026-11-01",
  fen_before: START,
  move_uci: "e2e4",
  move_san: "e4",
  best_move_uci: "d2d4",
  best_move_san: "d4",
  eval_before: 50,
  eval_after: -250,
  centipawn_loss: 300,
  classification: "blunder",
  player_color: "white",
};

beforeEach(() => window.localStorage.clear());

describe("MistakeCard view mode", () => {
  it("shows both arrows, verdict, chip, meta and game link", () => {
    const { container } = render(<MistakeCard mistake={base} />);
    expect(container.querySelector('[data-arrow="bad"]')).toBeInTheDocument();
    expect(container.querySelector('[data-arrow="good"]')).toBeInTheDocument();
    expect(screen.getAllByText("This cost you about a piece.").length).toBeGreaterThan(0);
    expect(screen.getByText("About a piece")).toBeInTheDocument();
    expect(screen.getByText(/vs Magnus · 2026-11-01 · move 7/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See it in the game/ })).toHaveAttribute("href", "/games/g1?move=7");
    expect(screen.getByRole("img")).toHaveAccessibleName("This cost you about a piece.");
  });

  it("does not mount the interactive board", () => {
    render(<MistakeCard mistake={base} />);
    expect(screen.queryByTestId("teaching-board")).not.toBeInTheDocument();
  });

  it("Try button is reachable by role and name", () => {
    render(<MistakeCard mistake={base} />);
    const btn = screen.getByRole("button", { name: "Try it" });
    btn.focus();
    expect(btn).toHaveFocus();
  });

  it("renders context and numbers", () => {
    render(<MistakeCard mistake={base} context={<span>Played in 2s</span>} />);
    expect(screen.getByText("Played in 2s")).toBeInTheDocument();
    expect(screen.getByText("-2.50", { exact: false })).toBeInTheDocument();
  });
});

describe("MistakeCard try mode", () => {
  async function enter() {
    fireEvent.click(screen.getByRole("button", { name: "Try it" }));
    await screen.findByTestId("teaching-board");
  }

  it("entering Try hides the arrows and shows the prompt", async () => {
    const { container } = render(<MistakeCard mistake={base} />);
    await enter();
    expect(container.querySelector("[data-arrow]")).not.toBeInTheDocument();
    expect(screen.getByTestId("try-feedback")).toHaveTextContent("Your turn. Find a better move");
    expect(screen.getByTestId("try-feedback")).toHaveAttribute("aria-live", "polite");
  });

  it("correct move calls onSolved(true) and offers Next", async () => {
    const onSolved = jest.fn();
    const onNext = jest.fn();
    render(<MistakeCard mistake={base} onSolved={onSolved} onNext={onNext} />);
    await enter();
    fireEvent.click(screen.getByText("drop-d4"));
    expect(onSolved).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("try-feedback")).toHaveTextContent("Correct!");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("tap-to-move works", async () => {
    const onSolved = jest.fn();
    render(<MistakeCard mistake={base} onSolved={onSolved} />);
    await enter();
    fireEvent.click(screen.getByText("tap-d2"));
    expect(screen.getByTestId("teaching-board").dataset.rings).toBe("d2");
    fireEvent.click(screen.getByText("tap-d4"));
    expect(onSolved).toHaveBeenCalledWith(true);
  });

  it("wrong moves climb the hint ladder, then Show answer calls onSolved(false)", async () => {
    const onSolved = jest.fn();
    render(<MistakeCard mistake={base} onSolved={onSolved} />);
    await enter();
    const board = () => screen.getByTestId("teaching-board");

    fireEvent.click(screen.getByText("drop-e4"));
    expect(screen.getByTestId("try-feedback")).toHaveTextContent("Not quite");
    expect(board().dataset.rings).toBe("d2");
    expect(board().dataset.dots).toBe("");

    fireEvent.click(screen.getByText("drop-e4"));
    expect(board().dataset.dots).toBe("d4");
    expect(screen.queryByRole("button", { name: "Show answer" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("drop-e4"));
    expect(onSolved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(onSolved).toHaveBeenCalledWith(false);
    expect(board().dataset.arrows).toBe("1");
    expect(screen.getByTestId("try-feedback")).toHaveTextContent("The best move was d4.");
  });

  it("Hint button advances the ladder by keyboard", async () => {
    render(<MistakeCard mistake={base} />);
    await enter();
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByTestId("teaching-board").dataset.rings).toBe("d2");
  });

  it("tapping a target with nothing selected does nothing", async () => {
    render(<MistakeCard mistake={base} />);
    await enter();
    fireEvent.click(screen.getByText("tap-d4")); // no selection: nothing
    expect(screen.getByTestId("teaching-board").dataset.rings).toBe("");
  });
});

describe("MistakeCard states", () => {
  it("missing best move: no Try button, no green arrow, no throw", () => {
    const m = { ...base, best_move_uci: null, best_move_san: null };
    const { container } = render(<MistakeCard mistake={m} defaultMode="try" />);
    expect(screen.queryByRole("button", { name: "Try it" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-arrow="good"]')).not.toBeInTheDocument();
    expect(screen.queryByTestId("teaching-board")).not.toBeInTheDocument();
  });

  it("bad FEN falls back to a text row and warns once", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const m = { ...base, fen_before: "not a fen" };
    expect(() => render(<MistakeCard mistake={m} />)).not.toThrow();
    expect(screen.getByTestId("mistake-card-text")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try it" })).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("compact uses the small board", () => {
    const { container } = render(<MistakeCard mistake={base} compact />);
    expect(container.querySelector("[data-square]")).toBeInTheDocument();
  });

  it("skeleton renders", () => {
    render(<MistakeCardSkeleton />);
    expect(screen.getByTestId("mistake-card-skeleton")).toBeInTheDocument();
  });
});
