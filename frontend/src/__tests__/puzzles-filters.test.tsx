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
  usePathname: () => "/puzzles",
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
    expect(mockReplace).toHaveBeenCalledWith("/puzzles?motif=fork", { scroll: false });
  });

  it("uses the pathname, not a bare query, when clearing the last filter", async () => {
    mockQuery = "phase=endgame";
    render(<PuzzlesPage />);
    fireEvent.change(screen.getByLabelText("Filter by game phase"), {
      target: { value: "" },
    });
    expect(mockReplace).toHaveBeenCalledWith("/puzzles", { scroll: false });
    mockQuery = "motif=fork&phase=endgame";
  });

  it("shows a deep-linked value that is not in the option list as selected", () => {
    mockQuery = "motif=zugzwang";
    render(<PuzzlesPage />);
    const sel = screen.getByLabelText("Filter by tactical motif") as HTMLSelectElement;
    expect(sel.value).toBe("zugzwang");
    expect(sel.options[sel.selectedIndex].textContent).toBe("Zugzwang");
    mockQuery = "motif=fork&phase=endgame";
  });
});
