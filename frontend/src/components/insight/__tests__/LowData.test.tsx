import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LowData, { LOW_DATA } from "../LowData";

const action = { label: "Analyze more games", href: "/games" };

describe("LowData", () => {
  it("exports default thresholds", () => {
    expect(LOW_DATA).toEqual({ patterns: 10, perRow: 5, trendMonths: 3 });
  });

  it("none tier shows empty state with action, hides children", () => {
    render(
      <LowData have={0} need={10} unit="analyzedGames" action={action}>
        <p>REAL</p>
      </LowData>,
    );
    expect(screen.getByText("Nothing to show yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Analyze more games/ })).toBeInTheDocument();
    expect(screen.queryByText("REAL")).toBeNull();
  });

  it("partial tier shows counts, progress, unlock preview and action", () => {
    render(
      <LowData have={4} need={10} unit="analyzedGames" unlocks="your weakest phase" action={action}>
        <p>REAL</p>
      </LowData>,
    );
    expect(screen.getByText("You have 4 analyzed games. We need 10 analyzed games to spot patterns.")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "4");
    expect(bar).toHaveAttribute("aria-valuemax", "10");
    expect(screen.getByText(/your weakest phase/)).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("REAL")).toBeNull();
  });

  it("uses singular unit", () => {
    render(<LowData have={1} need={5} unit="endgames" />);
    expect(screen.getByText(/You have 1 endgame\./)).toBeInTheDocument();
  });

  it("enough tier renders children only", () => {
    render(
      <LowData have={10} need={10} unit="games">
        <p>REAL</p>
      </LowData>,
    );
    expect(screen.getByText("REAL")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
