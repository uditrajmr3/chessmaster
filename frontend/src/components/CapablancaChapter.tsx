import Link from "next/link";
import ReplayBoard from "@/components/ReplayBoard";
import { EXAMPLES } from "@/lib/capablancaExamples";
import type { Rule } from "@/lib/capablanca";

/**
 * One chapter of the Capablanca tutorial: each rule with its full explanation
 * and, where one exists, a steppable interactive board demonstrating it.
 */
export default function CapablancaChapter({
  eyebrow,
  title,
  intro,
  rules,
  checklist,
  prev,
  next,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  rules: Rule[];
  checklist?: { title: string; items: string[] };
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">{eyebrow}</p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">{title}</h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">{intro}</p>

      <div className="mt-12 space-y-12">
        {rules.map((r) => {
          const example = EXAMPLES[r.id];
          return (
            <section key={r.id} className="scroll-mt-20" id={r.id}>
              <div className="flex items-baseline gap-3">
                <span className="rounded-md bg-accent-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-accent-300">
                  {r.id}
                </span>
                <h2 className="font-display text-2xl font-semibold text-white">{r.title}</h2>
              </div>
              <p className="mt-3 leading-relaxed text-gray-400">{r.body}</p>
              {example && <ReplayBoard example={example} id={r.id} />}
            </section>
          );
        })}
      </div>

      {checklist && (
        <div className="mt-14 surface-card p-6">
          <h2 className="font-display text-xl font-semibold text-white">{checklist.title}</h2>
          <ul className="mt-4 space-y-2">
            {checklist.items.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-400">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500/70" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-16 flex items-center justify-between border-t border-ink-600 pt-8 text-sm">
        {prev && (
          <Link href={prev.href} className="text-accent-300 hover:text-accent-200">
            ← {prev.label}
          </Link>
        )}
        {next && (
          <Link href={next.href} className="text-accent-300 hover:text-accent-200">
            {next.label} →
          </Link>
        )}
      </div>
    </main>
  );
}
