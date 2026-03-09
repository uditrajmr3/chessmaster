const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Sync
  startSync: (username: string) =>
    fetchAPI("/sync", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),
  getSyncStatus: () =>
    fetchAPI<import("./types").SyncStatus>("/sync/status"),

  // Games
  getGames: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchAPI<import("./types").GameSummary[]>(`/games${query}`);
  },
  getGame: (id: string) =>
    fetchAPI<import("./types").GameDetail>(`/games/${id}`),

  // Analysis
  startAnalysis: () =>
    fetchAPI("/analyze", { method: "POST" }),
  getAnalysisStatus: () =>
    fetchAPI<import("./types").AnalyzeStatus>("/analyze/status"),

  // Stats
  getOverview: () =>
    fetchAPI<import("./types").OverviewStats>("/stats/overview"),

  // Patterns
  getPatterns: () =>
    fetchAPI<import("./types").PatternReport>("/patterns"),

  // Openings
  getOpenings: () =>
    fetchAPI<import("./types").OpeningNode[]>("/openings/tree"),

  // Report
  generateReport: () =>
    fetchAPI("/report/generate", { method: "POST" }),
  getReportStatus: () =>
    fetchAPI<{ status: string; error: string | null }>("/report/status"),
  getLatestReport: () =>
    fetchAPI<import("./types").ReportData | null>("/report/latest"),

  // Puzzles
  getNextPuzzle: (params?: { phase?: string; motif?: string }) => {
    const query = params ? "?" + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString() : "";
    return fetchAPI<import("./types").Puzzle | null>(`/puzzles/next${query}`);
  },
  submitPuzzle: (puzzleId: number, moveUci: string) =>
    fetchAPI<import("./types").PuzzleResult>(`/puzzles/${puzzleId}/submit`, {
      method: "POST",
      body: JSON.stringify({ move_uci: moveUci }),
    }),
  getPuzzleStats: () =>
    fetchAPI<import("./types").PuzzleStats>("/puzzles/stats"),

  // Time Management
  getTimeManagement: () =>
    fetchAPI<import("./types").TimeManagementProfile>("/time-management"),

  // Tilt Detection
  getTiltReport: () =>
    fetchAPI<import("./types").TiltReport>("/tilt"),
};
