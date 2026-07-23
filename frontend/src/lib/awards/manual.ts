/**
 * Manual tracking for awards that have no detectable `rule` (design spec
 * §5.4). No auth, no backend — just localStorage, scoped by a version key so
 * a future schema change can migrate cleanly instead of silently misreading
 * old data.
 */
const STORAGE_KEY = "chessint.awards.manual.v1";

export type ManualState = Record<string, boolean>;

export function readManual(): ManualState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as ManualState;
  } catch {
    return {};
  }
}

/** Toggle one award's manual state and persist it. Returns the full updated
 * map so callers can update their own React state from a single source. */
export function writeManual(id: string, on: boolean): ManualState {
  const next = { ...readManual() };
  if (on) next[id] = true;
  else delete next[id]; // absence == false, keeps storage small
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode, quota) — the checkbox still
      // reflects state for this session, it just won't persist.
    }
  }
  return next;
}
