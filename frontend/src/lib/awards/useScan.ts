"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import type { ScanResult } from "./types";

const STORAGE_KEY = "chessint.awards.scan.v1";
const POLL_MS = 1500;
const TIMEOUT_MS = 5 * 60 * 1000; // stop polling a wedged job after 5 minutes

export type ScanStatus = "idle" | "queued" | "running" | "error" | "done";

interface StoredScan {
  username: string;
  scan: ScanResult;
}

interface ScanJob {
  status: ScanStatus;
  progress?: { months_done: number; months_total: number };
  result?: ScanResult;
  error?: string;
}

/** The last completed scan, straight from localStorage — used both to seed
 * `useScan`'s initial state and by pages that only need to *read* the last
 * result (category/detail pages) without pulling in the polling machinery. */
export function readLastScan(): StoredScan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredScan>;
    return parsed?.scan ? (parsed as StoredScan) : null;
  } catch {
    return null;
  }
}

function writeLastScan(value: StoredScan | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — the scan still worked, it just won't be restored
    // on the next visit.
  }
}

export interface UseScanResult {
  scan: ScanResult | null;
  username: string | null;
  status: ScanStatus;
  progress: { months_done: number; months_total: number };
  error: string | null;
  start: (username: string) => void;
  clear: () => void;
}

/**
 * Kick off a Chess.com award scan and poll it to completion.
 *
 * POSTs /awards/scan, then polls GET /awards/scan/{job_id} every 1.5s until
 * the job is `done` or `error`. Clears its interval/timeout on unmount, and
 * gives up after 5 minutes so a wedged job never polls forever. The last
 * successful scan is cached in localStorage so a return visit shows results
 * instantly without re-scanning.
 */
export function useScan(): UseScanResult {
  const initial = readLastScan();

  const [scan, setScan] = useState<ScanResult | null>(initial?.scan ?? null);
  const [username, setUsername] = useState<string | null>(initial?.username ?? null);
  const [status, setStatus] = useState<ScanStatus>(initial ? "done" : "idle");
  const [progress, setProgress] = useState({ months_done: 0, months_total: 0 });
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a stale poll loop writing state after start() is called
  // again (new job) or the component unmounts.
  const activeJobRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Unmount cleanup only — stopPolling is stable across renders.
  useEffect(() => stopPolling, [stopPolling]);

  const start = useCallback(
    (rawUsername: string) => {
      const uname = rawUsername.trim();
      if (!uname) return;

      stopPolling();
      const jobToken = uname + ":" + Date.now();
      activeJobRef.current = jobToken;

      setError(null);
      setScan(null);
      setUsername(uname);
      setStatus("queued");
      setProgress({ months_done: 0, months_total: 0 });

      void (async () => {
        let jobId: string;
        try {
          const res = await fetch(`${API_BASE}/awards/scan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: "chesscom", username: uname }),
          });
          if (activeJobRef.current !== jobToken) return; // superseded

          if (!res.ok) {
            const body = await res.json().catch(() => null);
            const detail = Array.isArray(body?.detail)
              ? body.detail
                  .map((d: { msg?: string }) => d?.msg)
                  .filter(Boolean)
                  .join(", ")
              : body?.detail;
            setStatus("error");
            setError(
              typeof detail === "string" && detail
                ? detail
                : "Could not start the scan. Check the username and try again."
            );
            return;
          }
          const body = (await res.json()) as { job_id: string; cached: boolean };
          jobId = body.job_id;
        } catch {
          if (activeJobRef.current !== jobToken) return;
          setStatus("error");
          setError("Could not reach the server. Check your connection and try again.");
          return;
        }

        const poll = async () => {
          if (activeJobRef.current !== jobToken) return;
          try {
            const r = await fetch(`${API_BASE}/awards/scan/${jobId}`);
            if (activeJobRef.current !== jobToken) return;
            if (!r.ok) throw new Error(`status ${r.status}`);
            const job = (await r.json()) as ScanJob;

            setStatus(job.status);
            if (job.progress) setProgress(job.progress);

            if (job.status === "done") {
              stopPolling();
              if (job.result) {
                setScan(job.result);
                writeLastScan({ username: uname, scan: job.result });
              }
            } else if (job.status === "error") {
              stopPolling();
              setError(job.error || "The scan failed. Try again shortly.");
            }
          } catch {
            if (activeJobRef.current !== jobToken) return;
            stopPolling();
            setStatus("error");
            setError("Lost connection while scanning. Try again.");
          }
        };

        await poll();
        if (activeJobRef.current !== jobToken) return;
        intervalRef.current = setInterval(poll, POLL_MS);
        timeoutRef.current = setTimeout(() => {
          if (activeJobRef.current !== jobToken) return;
          stopPolling();
          setStatus((s) => (s === "done" || s === "error" ? s : "error"));
          setError((e) => e ?? "This scan is taking too long. Try again in a moment.");
        }, TIMEOUT_MS);
      })();
    },
    [stopPolling]
  );

  const clear = useCallback(() => {
    activeJobRef.current = null;
    stopPolling();
    setScan(null);
    setUsername(null);
    setStatus("idle");
    setProgress({ months_done: 0, months_total: 0 });
    setError(null);
    writeLastScan(null);
  }, [stopPolling]);

  return { scan, username, status, progress, error, start, clear };
}
