/**
 * Puzzles page: filters are preselected from ?phase= / ?motif= and changes
 * are written back to the URL.
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const mockReplace = jest.fn();
let mockQuery = "motif=fork&phase=endgame";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockQuery),
}));

jest.mock("react-chessboard", () => ({ Chessboard: () => <div /> }));

jest.mock("@/lib/api", () => ({
  api: {
    getNextPuzzle: jest.fn().mockResolvedValue(null),
    getPuzzleStats: jest.fn().mockResolvedValue(null),
  },
}));

import PuzzlesPage from "@/app/(app)/puzzles/page";
import { api } from "@/lib/api";

describe("PuzzlesPage deep links", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    (api.getNextPuzzle as jest.Mock).mockClear();
  });

  it("preselects filters from search params and queries with them", async () => {
    render(<PuzzlesPage />);
    expect(
      (screen.getByLabelText("Filter by game phase") as HTMLSelectElement).value,
    ).toBe("endgame");
    expect(
      (screen.getByLabelText("Filter by tactical motif") as HTMLSelectElement).value,
    ).toBe("fork");
    await waitFor(() =>
      expect(api.getNextPuzzle).toHaveBeenCalledWith({ phase: "endgame", motif: "fork" }),
    );
  });

  it("writes changes to the URL, dropping empty params", async () => {
    render(<PuzzlesPage />);
    fireEvent.change(screen.getByLabelText("Filter by game phase"), {
      target: { value: "" },
    });
    expect(mockReplace).toHaveBeenCalledWith("?motif=fork", { scroll: false });
  });
});
