"use client";

import { useTranslations } from "next-intl";
import NextStep, { type NextStepProps } from "./NextStep";
import { TONE_STYLE, type InsightTone } from "./tone";

export interface PageAnswerProps {
  /** The user's question, shown small above the answer. */
  question: string;
  /** Headline sentence answering it. */
  answer: string;
  tone: InsightTone;
  action?: NextStepProps;
}

/** Mandatory first block of every analysis page. */
export default function PageAnswer({ question, answer, tone, action }: PageAnswerProps) {
  const tt = useTranslations("plain");
  const { icon: Icon, border, text } = TONE_STYLE[tone];

  return (
    <section
      data-tone={tone}
      aria-label={question}
      className={`surface-card rounded-2xl border-l-4 ${border} p-5 sm:p-6`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-white/55">{question}</p>
      <div className="mt-2 flex items-start gap-3">
        <Icon className={`mt-1 h-6 w-6 shrink-0 ${text}`} aria-hidden="true" />
        <h2 className="text-xl font-bold leading-snug text-white sm:text-2xl">
          <span className="sr-only">{tt(`tone.${tone}`)}: </span>
          {answer}
        </h2>
      </div>
      {action && (
        <div className="mt-4">
          <NextStep {...action} />
        </div>
      )}
    </section>
  );
}
