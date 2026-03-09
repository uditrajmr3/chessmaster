"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import type { SyncStatus, AnalyzeStatus } from "@/lib/types";

export default function StatusBar() {
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeStatus | null>(null);
  const [showDone, setShowDone] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  const syncDone = sync?.status === "done";
  const analysisDone = analysis?.status === "done";

  useEffect(() => {
    if (syncDone || analysisDone) {
      setShowDone(true);
      setDismissing(false);
      const timer = setTimeout(() => {
        setDismissing(true);
        setTimeout(() => setShowDone(false), 300);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [syncDone, analysisDone]);

  async function poll() {
    try {
      const [syncRes, analysisRes] = await Promise.all([
        fetch("http://localhost:8000/api/sync/status").then((r) => r.json()),
        fetch("http://localhost:8000/api/analyze/status").then((r) => r.json()),
      ]);
      setSync(syncRes);
      setAnalysis(analysisRes);
    } catch {
      // backend not running
    }
  }

  const isSyncing = sync?.status === "syncing";
  const isAnalyzing = analysis?.status === "running";
  const syncError = sync?.status === "error";
  const analysisError = analysis?.status === "error";
  const showSyncDone = syncDone && showDone;
  const showAnalysisDone = analysisDone && showDone;

  if (!isSyncing && !isAnalyzing && !showSyncDone && !showAnalysisDone && !syncError && !analysisError) {
    return null;
  }

  const doneClass = dismissing ? "animate-slide-out-up" : "animate-slide-in-down";

  return (
    <div className="fixed top-12 lg:top-0 left-0 lg:left-64 right-0 z-40 flex flex-col gap-0">
      {isSyncing && (
        <div className="animate-slide-in-down bg-accent-900/90 backdrop-blur-sm border-b border-accent-700/50 px-6 py-2.5 flex items-center gap-3">
          <Spinner className="text-accent-400" />
          <span className="text-accent-200 text-sm font-medium">
            Syncing games... {sync?.message}
            {sync?.games_fetched ? ` (${sync.games_fetched} fetched)` : ""}
          </span>
        </div>
      )}

      {isAnalyzing && (
        <div className="animate-slide-in-down bg-accent-900/90 backdrop-blur-sm border-b border-accent-700/50 px-6 py-2.5 flex items-center gap-3">
          <Spinner className="text-accent-400" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-accent-200 text-sm font-medium">
                Analyzing games with Stockfish... {analysis?.completed}/{analysis?.total}
              </span>
              <span className="text-accent-400 text-xs font-mono">
                {analysis?.total
                  ? `${Math.round(((analysis?.completed ?? 0) / analysis.total) * 100)}%`
                  : ""}
              </span>
            </div>
            {(analysis?.total ?? 0) > 0 && (
              <div className="mt-1.5 h-1.5 bg-accent-950/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent-500 to-accent-400 rounded-full progress-animated"
                  style={{
                    width: `${((analysis?.completed ?? 0) / (analysis?.total || 1)) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {showSyncDone && (
        <div className={`${doneClass} bg-green-900/90 backdrop-blur-sm border-b border-green-700/50 px-6 py-2.5 flex items-center gap-3`}>
          <CheckCircle className="w-4.5 h-4.5 text-green-400" />
          <span className="text-green-200 text-sm font-medium">
            Sync complete — {sync?.games_fetched} games fetched
          </span>
        </div>
      )}

      {showAnalysisDone && (
        <div className={`${doneClass} bg-green-900/90 backdrop-blur-sm border-b border-green-700/50 px-6 py-2.5 flex items-center gap-3`}>
          <CheckCircle className="w-4.5 h-4.5 text-green-400" />
          <span className="text-green-200 text-sm font-medium">
            Analysis complete — {analysis?.completed} games analyzed. Refresh the page to see results.
          </span>
        </div>
      )}

      {syncError && (
        <div className="animate-slide-in-down bg-red-900/90 backdrop-blur-sm border-b border-red-700/50 px-6 py-2.5 flex items-center gap-3">
          <XCircle className="w-4.5 h-4.5 text-red-400" />
          <span className="text-red-200 text-sm font-medium">Sync error: {sync?.message}</span>
        </div>
      )}

      {analysisError && (
        <div className="animate-slide-in-down bg-red-900/90 backdrop-blur-sm border-b border-red-700/50 px-6 py-2.5 flex items-center gap-3">
          <XCircle className="w-4.5 h-4.5 text-red-400" />
          <span className="text-red-200 text-sm font-medium">
            Analysis error: {analysis?.current_game}
          </span>
        </div>
      )}
    </div>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
