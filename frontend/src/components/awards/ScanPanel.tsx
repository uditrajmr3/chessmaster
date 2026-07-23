"use client";

import { useState } from "react";
import { AlertTriangle, Search, X } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { ScanResult } from "@/lib/awards/types";
import type { ScanStatus } from "@/lib/awards/useScan";

const USERNAME_RE = /^[A-Za-z0-9_-]{3,25}$/;

export interface ScanPanelProps {
  username: string | null;
  scan: ScanResult | null;
  status: ScanStatus;
  progress: { months_done: number; months_total: number };
  error: string | null;
  onStart: (username: string) => void;
  onClear: () => void;
}

/**
 * The scan box: username input, Scan button, and a DETERMINATE progress bar
 * while a scan runs. A scan can take up to a minute for a heavy account, so
 * a bare spinner reads as broken — this always shows real numbers.
 */
export default function ScanPanel({
  username,
  scan,
  status,
  progress,
  error,
  onStart,
  onClear,
}: ScanPanelProps) {
  const [draft, setDraft] = useState(username ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const isRunning = status === "queued" || status === "running";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!USERNAME_RE.test(trimmed)) {
      setFormError("Enter a valid Chess.com username (3–25 letters, numbers, - or _).");
      return;
    }
    setFormError(null);
    onStart(trimmed);
  }

  return (
    <div className="surface-card p-6">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label htmlFor="chesscom-username" className="sr-only">
            Chess.com username
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
              aria-hidden
            />
            <input
              id="chesscom-username"
              name="username"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Your Chess.com username, e.g. hikaru"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isRunning}
              className="w-full rounded-lg border border-ink-600 bg-ink-900 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 disabled:opacity-60"
            />
          </div>
          {formError && <p className="mt-2 text-xs text-red-400">{formError}</p>}
        </div>
        <button
          type="submit"
          disabled={isRunning || draft.trim().length === 0}
          className="shrink-0 rounded-lg bg-accent-500 px-6 py-2.5 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? "Scanning…" : scan ? "Scan again" : "Scan"}
        </button>
      </form>

      {isRunning && (
        <div className="mt-5">
          {progress.months_total > 0 ? (
            <ProgressBar
              value={progress.months_done}
              max={progress.months_total}
              label={`Scanning games — ${progress.months_done}/${progress.months_total} months`}
            />
          ) : (
            <p className="text-xs text-gray-400">Fetching your game archives from Chess.com…</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            This can take up to a minute for accounts with a lot of history — no need to
            reload.
          </p>
        </div>
      )}

      {status === "error" && error && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {status === "done" && scan && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-900/60 p-3 text-sm">
          <span className="text-gray-300">
            Scanned <span className="font-semibold text-white">{scan.username}</span> —{" "}
            {scan.games_parsed.toLocaleString()} games
            {scan.games_skipped > 0 && ` (${scan.games_skipped} skipped)`}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
        </div>
      )}

      {status === "done" && scan?.truncated && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            This account has more than 25,000 games — only the most recent games were
            scanned, so some older progress may be missing.
          </span>
        </div>
      )}
    </div>
  );
}
