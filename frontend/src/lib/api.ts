export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

// Friendly text for the structured error codes FastAPI-Users returns, so the
// UI can show something meaningful instead of "API error: 400".
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  REGISTER_USER_ALREADY_EXISTS: "An account with this email already exists. Try signing in instead.",
  REGISTER_INVALID_PASSWORD: "That password isn't valid. Please choose a stronger one.",
  LOGIN_BAD_CREDENTIALS: "Incorrect email or password.",
  LOGIN_USER_NOT_VERIFIED: "Please verify your email before signing in.",
  VERIFY_USER_BAD_TOKEN: "This verification link is invalid or has expired.",
  VERIFY_USER_ALREADY_VERIFIED: "Your email is already verified — you can sign in.",
  RESET_PASSWORD_BAD_TOKEN: "This reset link is invalid or has expired.",
};

type ErrorDetail =
  | string
  | { code?: string; reason?: string }
  | Array<{ msg?: string }>
  | undefined;

// Turn a non-OK response into an Error with a human-readable message. FastAPI
// puts the cause under `detail`: a code string, a {code, reason} object, or a
// validation array (422). We map known codes and fall back gracefully.
async function errorFromResponse(res: Response): Promise<Error> {
  let detail: ErrorDetail;
  try {
    const body = (await res.json()) as { detail?: ErrorDetail };
    detail = body?.detail;
  } catch {
    detail = undefined;
  }
  if (typeof detail === "string") {
    return new Error(AUTH_ERROR_MESSAGES[detail] ?? detail);
  }
  if (Array.isArray(detail)) {
    const msg = detail.map((e) => e?.msg).filter(Boolean).join(", ");
    return new Error(msg || `Request failed (${res.status}).`);
  }
  if (detail && typeof detail === "object") {
    if (detail.code) return new Error(AUTH_ERROR_MESSAGES[detail.code] ?? detail.reason ?? detail.code);
    if (detail.reason) return new Error(detail.reason);
  }
  return new Error(`Something went wrong (${res.status}). Please try again.`);
}

// Parse a successful response body, tolerating empty bodies (204 No Content
// from login/logout, 202 Accepted from forgot-password, etc.). Calling
// res.json() on an empty body throws, which previously broke the login flow.
async function parseBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    // Empty body (e.g. 202 Accepted) — nothing to parse.
    return undefined as T;
  }
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    throw new AuthError(`API error: ${res.status} ${res.statusText}`);
  }
  if (!res.ok) {
    throw await errorFromResponse(res);
  }
  return parseBody<T>(res);
}

async function fetchFormAPI<T>(path: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  if (res.status === 401) {
    throw new AuthError(`API error: ${res.status} ${res.statusText}`);
  }
  if (!res.ok) {
    throw await errorFromResponse(res);
  }
  return parseBody<T>(res);
}

export const api = {
  // Auth
  register: ({ email, password }: { email: string; password: string }) =>
    fetchAPI<import("./types").User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: ({ email, password }: { email: string; password: string }) =>
    fetchFormAPI<import("./types").User>("/auth/login", {
      username: email,
      password,
    }),
  logout: () =>
    fetchAPI<void>("/auth/logout", { method: "POST" }),
  requestVerify: (email: string) =>
    fetchAPI<void>("/auth/request-verify-token", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  verifyEmail: (token: string) =>
    fetchAPI<void>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  forgotPassword: (email: string) =>
    fetchAPI<void>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    fetchAPI<void>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  // Users
  getMe: () =>
    fetchAPI<import("./types").User>("/users/me"),
  updateMe: (data: { lichess_username?: string; chesscom_username?: string }) =>
    fetchAPI<import("./types").User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Sync
  startSync: () =>
    fetchAPI("/sync", {
      method: "POST",
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
  getPending: () =>
    fetchAPI<import("./types").PendingGame[]>("/analyze/pending"),
  postAnalysisResults: (payload: import("./types").AnalyzeResultsPayload) =>
    fetchAPI<void>("/analyze/results", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

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

  // Import
  importPgnText: (pgn: string) =>
    fetchAPI<{ imported: number; skipped: number; errors: string[] }>("/import/pgn-text", {
      method: "POST",
      body: JSON.stringify({ pgn }),
    }),

  // Export
  getExportSummary: (filters?: import("./types").GameFilters) => {
    const query = filters ? "?" + new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ).toString() : "";
    return fetchAPI<Record<string, unknown>>(`/export/summary${query}`);
  },
};
