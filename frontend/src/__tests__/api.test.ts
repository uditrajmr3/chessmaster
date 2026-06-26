/**
 * Tests for the API client module.
 * Validates that api.ts constructs correct URLs, handles responses,
 * and properly reports errors.
 */

import { api, AuthError } from "@/lib/api";

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

// ── credentials: "include" on every request ──

describe("fetchAPI credentials", () => {
  it('sends credentials: "include" on every request', async () => {
    mockJsonResponse({ status: "idle", games_fetched: 0, message: "" });
    await api.getSyncStatus();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: "include" })
    );
  });
});

// ── Auth ──

describe("api.login", () => {
  it("sends form-encoded body with username/password", async () => {
    mockJsonResponse({ id: "u1", email: "test@test.com", is_verified: true, is_active: true });
    await api.login({ email: "test@test.com", password: "secret" });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/auth/login");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(options.body as string);
    expect(body.get("username")).toBe("test@test.com");
    expect(body.get("password")).toBe("secret");
    expect(options.credentials).toBe("include");
  });
});

describe("api.register", () => {
  it("sends JSON POST to /auth/register", async () => {
    mockJsonResponse({ id: "u1", email: "new@test.com", is_verified: false, is_active: true }, 201);
    await api.register({ email: "new@test.com", password: "pass123" });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/auth/register");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ email: "new@test.com", password: "pass123" });
  });
});

describe("api.logout", () => {
  it("sends POST to /auth/logout", async () => {
    mockJsonResponse({});
    await api.logout();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
  });
});

describe("api.getMe", () => {
  it("calls GET /users/me", async () => {
    mockJsonResponse({ id: "u1", email: "me@test.com", is_verified: true, is_active: true });
    const result = await api.getMe();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/users/me",
      expect.objectContaining({ credentials: "include" })
    );
    expect(result.email).toBe("me@test.com");
  });
});

describe("api.updateMe", () => {
  it("sends PATCH /users/me with JSON body", async () => {
    mockJsonResponse({ id: "u1", email: "me@test.com", lichess_username: "luser", chesscom_username: null });
    await api.updateMe({ lichess_username: "luser" });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/users/me");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({ lichess_username: "luser" });
  });
});

// ── Sync ──

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
  it("sends POST with no body (no username)", async () => {
    mockJsonResponse({ message: "Sync started" });
    await api.startSync();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/sync");
    expect(options.method).toBe("POST");
    // body should be absent or not contain username
    expect(options.body).toBeUndefined();
  });
});

// ── Games ──

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

// ── Analysis ──

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

describe("api.getPending", () => {
  it("calls GET /analyze/pending and returns list", async () => {
    const pending = [{ game_id: "g1", pgn: "1. e4", player_color: "white" }];
    mockJsonResponse(pending);
    const result = await api.getPending();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/analyze/pending",
      expect.objectContaining({ credentials: "include" })
    );
    expect(result).toHaveLength(1);
    expect(result[0].game_id).toBe("g1");
  });
});

describe("api.postAnalysisResults", () => {
  it("sends POST /analyze/results with JSON payload", async () => {
    mockJsonResponse({});
    const payload = {
      game_id: "g1",
      depth: 20,
      moves: [
        {
          move_number: 1,
          is_player_move: true,
          fen_before: "startpos",
          move_uci: "e2e4",
          move_san: "e4",
          eval_before: 0.2,
          eval_after: 0.3,
          best_move_uci: "e2e4",
        },
      ],
    };
    await api.postAnalysisResults(payload);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/analyze/results");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toMatchObject({ game_id: "g1", depth: 20 });
  });
});

// ── Stats ──

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

// ── Patterns ──

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

// ── Report ──

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

// ── Import ──

describe("api.importPgnText", () => {
  it("sends only pgn in body (no username)", async () => {
    mockJsonResponse({ imported: 2, skipped: 0, errors: [] });
    await api.importPgnText("1. e4 e5 *");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/import/pgn-text");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body).toEqual({ pgn: "1. e4 e5 *" });
    expect(body.username).toBeUndefined();
  });
});

// ── Error handling ──

describe("error handling", () => {
  it("throws AuthError on 401 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    });
    await expect(api.getOverview()).rejects.toThrow(AuthError);
  });

  it("throws AuthError (not generic Error) on 401", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    });
    try {
      await api.getOverview();
      fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("throws on non-OK response (non-401)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    });
    await expect(api.getOverview()).rejects.toThrow("Something went wrong (500)");
  });

  it("throws generic Error (not AuthError) on 500", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    });
    try {
      await api.getOverview();
      fail("should have thrown");
    } catch (e) {
      expect(e).not.toBeInstanceOf(AuthError);
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("throws on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(api.getOverview()).rejects.toThrow("Network error");
  });
});
