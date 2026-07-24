import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import GuidedPlay from "@/components/lessons/GuidedPlay";
import { setRequestLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Play Chess with a Coach — Guided Practice",
  description:
    "Play a chess bot at a fixed rating (300–1900) while a coach runs Capablanca's three-question loop every move and suggests sound, principle-based moves. Choose your side, opening, and difficulty.",
  alternates: { canonical: "/learn/coach" },
  keywords: [
    "play chess with coaching",
    "chess coach app",
    "play chess bot for beginners",
    "guided chess practice",
    "capablanca training",
  ],
};

export default async function CoachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Play with a coach
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        Play a game, guided every move
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-400">
        Choose a side, a familiar opening, and how strong the bot should be. As
        you play, your coach runs{" "}
        <Link href="/learn/capablanca" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
          Capablanca&rsquo;s three questions
        </Link>{" "}
        every move — what did they threaten, which piece is idle, who&rsquo;s in
        your half — and can hand you a sound move with the rule behind it.
      </p>

      <div className="mt-8">
        <GuidedPlay />
      </div>
    </main>
  );
}
