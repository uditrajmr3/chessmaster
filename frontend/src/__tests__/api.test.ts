/**
 * Tests for the API client module.
 * Validates that api.ts constructs correct URLs, handles responses,
 * and properly reports errors.
 */

import { api } from "@/lib/api";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function mockJsonResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => data,
  });
}

describe("api.getSyncStatus", () => {
  it("calls the correct endpoint", async () => {
    mockJsonResponse({ status: "idle", games_fetched: 0, message: "" });
    const result = await api.getSyncStatus();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/sync/status",
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(result.status).toBe("idle");
  });
});

describe("api.startSync", () => {
  it("sends POST with username in body", async () => {
    mockJsonResponse({ message: "Sync started" });
    await api.startSync("csense2653");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/sync",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "csense2653" }),
      })
    );
  });
});

describe("api.getGames", () => {
  it("calls /games with no params by default", async () => {
    mockJsonResponse([]);
    await api.getGames();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/games",
      expect.any(Object)
    );
  });

  it("passes query params correctly", async () => {
    mockJsonResponse([]);
    await api.getGames({ platform: "lichess", result: "win" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("platform=lichess");
    expect(url).toContain("result=win");
  });
});

describe("api.getGame", () => {
  it("fetches a specific game by ID", async () => {
    const mockGame = {
      id: "chesscom_abc",
      platform: "chesscom",
      pgn: "1. e4 e5",
      moves: [],
    };
    mockJsonResponse(mockGame);
    const result = await api.getGame("chesscom_abc");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/games/chesscom_abc",
      expect.any(Object)
    );
    expect(result.id).toBe("chesscom_abc");
  });
});

describe("api.getOverview", () => {
  it("fetches stats overview", async () => {
    const mockStats = {
      total_games: 100,
      wins: 50,
      losses: 40,
      draws: 10,
      platforms: { chesscom: 60, lichess: 40 },
      avg_accuracy: 75.5,
      rating_history: [],
    };
    mockJsonResponse(mockStats);
    const result = await api.getOverview();
    expect(result.total_games).toBe(100);
    expect(result.wins).toBe(50);
  });
});

describe("api.startAnalysis", () => {
  it("sends POST to /analyze", async () => {
    mockJsonResponse({ message: "Analysis started" });
    await api.startAnalysis();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/analyze",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("api.getPatterns", () => {
  it("fetches pattern report", async () => {
    const mockPatterns = {
      phase_accuracy: { opening: 15.0, middlegame: 25.0, endgame: 35.0 },
      missed_tactics: { fork: 5, pin: 3 },
      blunder_rate_normal: 2.5,
      blunder_rate_time_trouble: 8.1,
    };
    mockJsonResponse(mockPatterns);
    const result = await api.getPatterns();
    expect(result.phase_accuracy.opening).toBe(15.0);
    expect(result.missed_tactics.fork).toBe(5);
  });
});

describe("api.getLatestReport", () => {
  it("returns null when no report exists", async () => {
    mockJsonResponse(null);
    const result = await api.getLatestReport();
    expect(result).toBeNull();
  });

  it("returns report data when available", async () => {
    const mockReport = {
      id: 1,
      generated_at: "2025-06-15T12:00:00",
      games_count: 50,
      report_text: "Your main weakness is...",
      report_json: {},
    };
    mockJsonResponse(mockReport);
    const result = await api.getLatestReport();
    expect(result?.report_text).toContain("weakness");
  });
});

describe("error handling", () => {
  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    });
    await expect(api.getOverview()).rejects.toThrow("API error: 500");
  });

  it("throws on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(api.getOverview()).rejects.toThrow("Network error");
  });
});
