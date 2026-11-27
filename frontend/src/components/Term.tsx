"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Inline jargon explainer. Wrap any chess/analysis term so a beginner can get a
 * plain-English (or localized) definition without leaving the page:
 *
 *   <Term id="cpl" /> renders the term, e.g. "CPL (Centipawn Loss)"
 *   <Term id="cpl">CPL</Term> renders just "CPL"
 *
 * Text comes from the `glossary` message namespace, so tooltips follow the
 * chosen language. Definition shows on hover, keyboard focus, and tap (mobile);
 * accessible via aria-describedby, with a real button as the trigger.
 */
export default function Term({
  id,
  children,
}: {
  id: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("glossary");
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const tipRef = useRef<HTMLSpanElement>(null);
  // Keep an open tooltip inside the viewport near screen edges. A closed
  // tooltip is display:none so it never adds page scroll width.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    if (!open) return;
    const rect = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const pad = 8;
    if (rect.left < pad) el.style.marginLeft = `${pad - rect.left}px`;
    else if (rect.right > vw - pad) el.style.marginLeft = `${vw - pad - rect.right}px`;
  }, [open]);

  // Unknown id → render the children (or nothing) without a tooltip.
  if (!t.has(`${id}.term`)) return <>{children}</>;

  const term = t(`${id}.term`);
  const short = t(`${id}.short`);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="cursor-help border-b border-dotted border-accent-400/60 text-inherit underline-offset-2 hover:border-accent-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-400/50 rounded-[2px]"
      >
        {children ?? term}
      </button>
      <span
        ref={tipRef}
        id={tipId}
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-white/10 bg-ink-800 p-3 text-left text-xs font-normal leading-relaxed text-gray-300 shadow-xl transition duration-150 ease-out ${
          open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        }`}
        style={{ display: open ? undefined : "none" }}
      >
        <span className="mb-1 block font-semibold text-white">{term}</span>
        {short}
      </span>
    </span>
  );
}
