"use client";

import { useId, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

export const SHOW_NUMBERS_KEY = "chessint.showNumbers";

const listeners = new Set<() => void>();

function write(open: boolean) {
  try {
    window.localStorage.setItem(SHOW_NUMBERS_KEY, open ? "1" : "0");
    memory = null;
  } catch {
    memory = open; // storage unavailable: keep it for this page load
  }
  listeners.forEach((l) => l());
}

// Fallback so toggling still works (per page load) when storage throws.
let memory: boolean | null = null;

function snapshot(): boolean {
  try {
    const v = window.localStorage.getItem(SHOW_NUMBERS_KEY);
    if (v !== null) return v === "1";
  } catch {
    /* fall through to in-memory value */
  }
  return memory ?? false;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SHOW_NUMBERS_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Per-card "Show numbers" disclosure. Open state is remembered per browser. */
export default function ShowNumbers({ children }: { children: ReactNode }) {
  const t = useTranslations("mistakeCard");
  const id = useId();
  const open = useSyncExternalStore(subscribe, snapshot, () => false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => write(!open)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-300 hover:text-accent-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300"
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        {open ? t("hideNumbers") : t("showNumbers")}
      </button>
      <div id={id} hidden={!open} className="mt-2">
        {children}
      </div>
    </div>
  );
}
