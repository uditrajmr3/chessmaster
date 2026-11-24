import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import NextStep from "../NextStep";
import { puzzlesHref } from "@/lib/nextStep";

describe("puzzlesHref", () => {
  it("builds query strings", () => {
    expect(puzzlesHref({ motif: "fork", phase: "endgame" })).toBe("/puzzles?motif=fork&phase=endgame");
    expect(puzzlesHref({ phase: "endgame" })).toBe("/puzzles?phase=endgame");
    expect(puzzlesHref({ motif: "fork" })).toBe("/puzzles?motif=fork");
    expect(puzzlesHref()).toBe("/puzzles");
  });
});

describe("NextStep", () => {
  it("renders primary link with query params", () => {
    render(<NextStep label="Practise forks" href={puzzlesHref({ motif: "fork" })} />);
    const a = screen.getByRole("link", { name: /Practise forks/ });
    expect(a).toHaveAttribute("href", "/puzzles?motif=fork");
    expect(a.className).toContain("bg-accent-500");
    expect(a.className).toContain("min-h-11");
  });

  it("renders inline variant as text link", () => {
    render(<NextStep label="Learn" href="/learn" variant="inline" />);
    const a = screen.getByRole("link", { name: /Learn/ });
    expect(a.className).not.toContain("bg-accent-500");
    expect(a.className).toContain("text-accent-300");
  });

  it("renders a button and fires onClick when no href", () => {
    const fn = jest.fn();
    render(<NextStep label="Go" onClick={fn} />);
    fireEvent.click(screen.getByRole("button", { name: /Go/ }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("shows reason", () => {
    render(<NextStep label="Go" onClick={() => {}} reason="because 4 of 10" />);
    expect(screen.getByText("because 4 of 10")).toBeInTheDocument();
  });

  it("sticky renders a mobile-only fixed bar plus spacer", () => {
    render(<NextStep label="Go" onClick={() => {}} sticky />);
    const bar = screen.getByTestId("next-step-sticky");
    expect(bar.className).toContain("fixed");
    expect(bar.className).toContain("sm:static");
    expect(bar.className).toContain("pb-[max(0.75rem,env(safe-area-inset-bottom))]");
    expect(screen.getByTestId("next-step-spacer").className).toContain("sm:hidden");
  });

  it("non-sticky has no fixed bar or spacer", () => {
    render(<NextStep label="Go" onClick={() => {}} />);
    expect(screen.queryByTestId("next-step-sticky")).toBeNull();
    expect(screen.queryByTestId("next-step-spacer")).toBeNull();
  });
});
