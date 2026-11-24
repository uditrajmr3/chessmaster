import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AccuracyBadge, { accuracyGrade } from "../AccuracyBadge";

describe("accuracyGrade thresholds", () => {
  it.each([
    [100, "excellent"],
    [90, "excellent"],
    [89.94, "good"],
    [80, "good"],
    [79.9, "ok"],
    [70, "ok"],
    [69.9, "shaky"],
    [60, "shaky"],
    [59.9, "costly"],
    [0, "costly"],
  ])("%s -> %s", (v, g) => {
    expect(accuracyGrade(v)).toBe(g);
  });
});

describe("AccuracyBadge", () => {
  it("renders 'Not analyzed yet' for null, never a dash", () => {
    const { container } = render(<AccuracyBadge value={null} source={null} />);
    expect(screen.getByText("Not analyzed yet")).toBeInTheDocument();
    expect(container.textContent).not.toContain("—");
  });

  it("renders percent and grade word", () => {
    render(<AccuracyBadge value={91.26} source="chessint" />);
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByText(/91\.3/)).toBeInTheDocument();
  });

  it.each([
    [90, "Excellent"],
    [85, "Good"],
    [70, "OK"],
    [65, "Shaky"],
    [59, "Costly"],
  ])("shows grade word for %s", (v, word) => {
    render(<AccuracyBadge value={v} source="chessint" />);
    expect(screen.getByText(word)).toBeInTheDocument();
  });

  it("shows generic platform note when source is platform", () => {
    render(<AccuracyBadge value={75} source="platform" />);
    expect(screen.getByText("from Chess.com/Lichess")).toBeInTheDocument();
  });

  it("uses platformName when given", () => {
    render(<AccuracyBadge value={75} source="platform" platformName="Lichess" />);
    expect(screen.getByText("from Lichess")).toBeInTheDocument();
  });

  it("no platform note for chessint source; tooltip explains origin", () => {
    const { container } = render(<AccuracyBadge value={75} source="chessint" />);
    expect(screen.queryByText(/^from /)).toBeNull();
    expect(container.querySelector("[title]")).toHaveAttribute(
      "title",
      "Calculated by ChessInt from engine analysis",
    );
  });

  it("renders basedOn with plural", () => {
    const { rerender } = render(<AccuracyBadge value={80} source="chessint" basedOn={12} />);
    expect(screen.getByText("based on 12 games")).toBeInTheDocument();
    rerender(<AccuracyBadge value={80} source="chessint" basedOn={1} />);
    expect(screen.getByText("based on 1 game")).toBeInTheDocument();
  });
});
