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
  getPatterns: (filters?: import("./types").GameFilters) => {
    const query = filters ? "?" + new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ).toString() : "";
    return fetchAPI<import("./types").PatternReport>(`/patterns${query}`);
  },

  // Openings
  getOpenings: (filters?: import("./types").GameFilters) => {
    const query = filters ? "?" + new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ).toString() : "";
    return fetchAPI<import("./types").OpeningNode[]>(`/openings/tree${query}`);
  },

  // Report
  generateReport: () =>
    fetchAPI("/report/generate", { method: "POST" }),
  getReportStatus: () =>
    fetchAPI<{ status: string; error: string | null }>("/report/status"),
  getLatestReport: () =>
    fetchAPI<import("./types").ReportData | null>("/report/latest"),

  // Puzzles
  getNextPuzzle: (params?: { phase?: string; motif?: string; platform?: string; time_class?: string }) => {
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
  getTimeManagement: (filters?: import("./types").GameFilters) => {
    const query = filters ? "?" + new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ).toString() : "";
    return fetchAPI<import("./types").TimeManagementProfile>(`/time-management${query}`);
  },

  // Tilt Detection
  getTiltReport: (filters?: import("./types").GameFilters) => {
    const query = filters ? "?" + new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ).toString() : "";
    return fetchAPI<import("./types").TiltReport>(`/tilt${query}`);
  },

  // Rating Predictor
  getRatingPrediction: (filters?: import("./types").GameFilters) => {
    const query = filters ? "?" + new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ).toString() : "";
    return fetchAPI<import("./types").RatingPredictionReport>(`/rating-predictor${query}`);
  },

  // Endgame
  getEndgameReport: (filters?: import("./types").GameFilters) => {
    const query = filters ? "?" + new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ).toString() : "";
    return fetchAPI<import("./types").EndgameReport>(`/endgame${query}`);
  },

  // Digest
  getDigest: (params?: { days?: number; platform?: string; time_class?: string }) => {
    const query = params ? "?" + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString() : "";
    return fetchAPI<import("./types").DigestReport>(`/digest${query}`);
  },

  // Peer Comparison
  getPeerComparison: (filters?: import("./types").GameFilters) => {
    const query = filters ? "?" + new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ).toString() : "";
    return fetchAPI<import("./types").PeerComparisonReport>(`/peer-comparison${query}`);
  },

  // Scouting
  scoutOpponent: (params: { opponent_username: string; platform: string; max_games?: number }) =>
    fetchAPI<import("./types").ScoutReport>("/scouting/scout", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};
