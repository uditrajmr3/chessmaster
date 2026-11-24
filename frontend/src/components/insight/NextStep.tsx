"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export { puzzlesHref } from "@/lib/nextStep";

export interface NextStepProps {
  label: string;
  href?: string;
  onClick?: () => void;
  /** One line explaining why this is the suggested action. */
  reason?: string;
  variant?: "primary" | "inline";
  /** Fixed bottom bar on mobile (static from `sm:` up), with a spacer. */
  sticky?: boolean;
}

const PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300";
const INLINE =
  "inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-300 underline-offset-4 hover:text-accent-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300";

export default function NextStep({
  label,
  href,
  onClick,
  reason,
  variant = "primary",
  sticky = false,
}: NextStepProps) {
  const cls = variant === "primary" ? PRIMARY : INLINE;
  const content = (
    <>
      <span>{label}</span>
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </>
  );
  const control = href ? (
    <Link href={href} onClick={onClick} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );

  const body = (
    <div className="flex flex-col items-start gap-1">
      {control}
      {reason && <p className="text-xs text-white/55">{reason}</p>}
    </div>
  );

  if (!sticky) return body;

  return (
    <>
      <div
        data-testid="next-step-spacer"
        aria-hidden="true"
        className="h-[calc(6rem+env(safe-area-inset-bottom))] sm:hidden"
      />
      <div
        data-testid="next-step-sticky"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-900/95 px-4 pt-3 backdrop-blur sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-none pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0"
      >
        {body}
      </div>
    </>
  );
}
