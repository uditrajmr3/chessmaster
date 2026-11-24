import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import InsightCard from "../InsightCard";
import PageAnswer from "../PageAnswer";

const TONES = ["good", "warn", "bad", "neutral"] as const;

describe("InsightCard", () => {
  it.each(TONES)("tone %s renders icon, left border and sr-only word", (tone) => {
    const { container } = render(<InsightCard tone={tone} headline="You gave away a knight" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("article")!.className).toMatch(/border-l-4 border-l-/);
    expect(container.querySelector(".sr-only")).toBeInTheDocument();
  });

  it("uses a different icon per tone (not colour alone)", () => {
    const shapes = TONES.map((tone) => {
      const { container, unmount } = render(<InsightCard tone={tone} headline="x" />);
      const html = container.querySelector("svg")!.innerHTML;
      unmount();
      return html;
    });
    expect(new Set(shapes).size).toBe(4);
  });

  it("shows based-on text only when set", () => {
    const { rerender } = render(<InsightCard tone="neutral" headline="h" basedOn={12} />);
    expect(screen.getByText("based on 12 games")).toBeInTheDocument();
    rerender(<InsightCard tone="neutral" headline="h" basedOn={1} />);
    expect(screen.getByText("based on 1 game")).toBeInTheDocument();
    rerender(<InsightCard tone="neutral" headline="h" />);
    expect(screen.queryByText(/based on/)).toBeNull();
  });

  it("renders the action exactly once", () => {
    render(<InsightCard tone="bad" headline="h" action={{ label: "Practise forks", href: "/puzzles?motif=fork" }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("renders detail, evidence and numbers disclosure", () => {
    render(<InsightCard tone="warn" headline="h" detail="d" evidence={<div>chart</div>} numbers={<span>CPL 80</span>} />);
    expect(screen.getByText("d")).toBeInTheDocument();
    expect(screen.getByText("chart")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show numbers" })).toBeInTheDocument();
  });
});

describe("PageAnswer", () => {
  it.each(TONES)("tone %s renders icon and border", (tone) => {
    const { container } = render(<PageAnswer tone={tone} question="Where do I lose?" answer="In the endgame" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("section")!.className).toMatch(/border-l-4 border-l-/);
  });

  it("shows question above answer and one action", () => {
    render(
      <PageAnswer tone="bad" question="Where do I lose?" answer="In the endgame" action={{ label: "Go", href: "/puzzles?phase=endgame" }} />,
    );
    expect(screen.getByText("Where do I lose?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /In the endgame/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
