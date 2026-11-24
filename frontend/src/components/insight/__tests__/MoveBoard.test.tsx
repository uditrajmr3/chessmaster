import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MoveBoard from "../MoveBoard";
import { ARROW_TONES, BOARD_THEME } from "@/lib/boardTheme";

const START_W = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const START_B = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

describe("MoveBoard", () => {
  it("renders 64 squares with role=img and aria-label", () => {
    const { container } = render(<MoveBoard fen={START_W} ariaLabel="Start" />);
    expect(screen.getByRole("img", { name: "Start" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-square]")).toHaveLength(64);
  });

  it("white to move: a8 first; black to move: h1 first", () => {
    const w = render(<MoveBoard fen={START_W} ariaLabel="w" />);
    expect(w.container.querySelector("[data-square]")?.getAttribute("data-square")).toBe("a8");
    w.unmount();
    const b = render(<MoveBoard fen={START_B} ariaLabel="b" />);
    expect(b.container.querySelector("[data-square]")?.getAttribute("data-square")).toBe("h1");
  });

  it("explicit orientation overrides side to move", () => {
    const { container } = render(<MoveBoard fen={START_B} orientation="white" ariaLabel="x" />);
    expect(container.querySelector("[data-square]")?.getAttribute("data-square")).toBe("a8");
  });

  it("renders arrows with tone colours and legend text", () => {
    const { container } = render(
      <MoveBoard
        fen={START_W}
        ariaLabel="x"
        arrows={[
          { from: "e2", to: "e4", tone: "bad" },
          { from: "d2", to: "d4", tone: "good" },
          { from: "g1", to: "f3", tone: "threat" },
        ]}
      />,
    );
    expect(container.querySelector('[data-arrow="bad"]')?.getAttribute("fill")).toBe(ARROW_TONES.bad);
    expect(container.querySelector('[data-arrow="good"]')?.getAttribute("fill")).toBe(ARROW_TONES.good);
    expect(container.querySelector('[data-arrow="threat"]')?.getAttribute("fill")).toBe(ARROW_TONES.threat);
    expect(screen.getByText("You played")).toBeInTheDocument();
    expect(screen.getByText("Better")).toBeInTheDocument();
    expect(screen.getByText("Their threat")).toBeInTheDocument();
  });

  it("uses wood palette squares and no legend without arrows", () => {
    const { container } = render(<MoveBoard fen={START_W} ariaLabel="x" />);
    const sq = container.querySelector('[data-square="a1"]') as HTMLElement;
    expect(sq.style.backgroundColor).not.toBe("");
    expect(BOARD_THEME.light).not.toBe(BOARD_THEME.dark);
    expect(screen.queryByText("Better")).toBeNull();
  });

  it("bad FEN does not throw and renders empty board", () => {
    const { container } = render(<MoveBoard fen="garbage" ariaLabel="bad" />);
    expect(screen.getByRole("img", { name: "bad" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-square]")).toHaveLength(64);
    expect(container.querySelectorAll("svg svg, [data-square] svg")).toHaveLength(0);
  });
});
