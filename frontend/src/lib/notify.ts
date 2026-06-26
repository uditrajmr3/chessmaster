import { useEffect } from "react";

// ── In-app analysis-complete signal ───────────────────────────────────────
// Browser-side analysis runs in the Sidebar; the StatusBar (a sibling) shows
// the completion banner. They share state through this window event.

export const ANALYSIS_DONE_EVENT = "chess:analysis-done";

interface AnalysisDoneDetail {
  analyzed: number;
}

export function emitAnalysisDone(analyzed: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<AnalysisDoneDetail>(ANALYSIS_DONE_EVENT, {
        detail: { analyzed },
      })
    );
  }
}

export function useAnalysisDone(callback: (analyzed: number) => void) {
  useEffect(() => {
    const handler = (e: Event) =>
      callback((e as CustomEvent<AnalysisDoneDetail>).detail?.analyzed ?? 0);
    window.addEventListener(ANALYSIS_DONE_EVENT, handler);
    return () => window.removeEventListener(ANALYSIS_DONE_EVENT, handler);
  }, [callback]);
}

// ── System (OS) notifications ──────────────────────────────────────────────
// Cross-tab: analysis can take minutes, so the user is usually on another tab
// when it finishes. A system notification reaches them there.

export function requestNotifyPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {});
    }
  } catch {
    /* Notification API unavailable — ignore */
  }
}

export function systemNotify(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon.svg" });
    }
  } catch {
    /* some browsers throw if not from a service worker — ignore */
  }
}
