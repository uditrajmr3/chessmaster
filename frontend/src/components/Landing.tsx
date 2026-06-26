import Link from "next/link";

const FEATURES = [
  {
    title: "Full-game engine analysis",
    body: "Stockfish runs in your browser and evaluates every move of every game — no server queue, no waiting.",
  },
  {
    title: "Your recurring weaknesses",
    body: "Not one-off blunders — the mistakes you repeat, broken down by phase, tactical motif, and opening.",
  },
  {
    title: "Opening intelligence",
    body: "See which of your lines actually win and which quietly lose, with real win-rates from your own games.",
  },
  {
    title: "A personal AI coach",
    body: "A written report that reads like a coach who studied hundreds of your games, with drills to fix each gap.",
  },
];

const STEPS = [
  { n: "01", title: "Connect", body: "Link your Lichess or Chess.com username." },
  { n: "02", title: "Analyze", body: "ChessInt reviews your full game history with the engine." },
  { n: "03", title: "Improve", body: "Get your weaknesses, an AI coaching report, and targeted puzzles." },
];

export default function Landing() {
  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <header className="flex flex-col items-center pt-24 pb-16 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="ChessInt logo" width={56} height={56} />
          <p className="font-mono mt-6 text-xs uppercase tracking-[0.3em] text-accent-400">
            Chess Intelligence · Since 2026
          </p>
          <h1 className="font-display mt-4 text-4xl font-semibold sm:text-6xl text-white">
            Turn your games into a coach.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">
            <strong className="text-white">ChessInt</strong> is chess
            intelligence for your own games. Connect{" "}
            <strong className="text-white">Lichess</strong> or{" "}
            <strong className="text-white">Chess.com</strong>, and get full engine
            analysis, the weaknesses you repeat, and a personal AI coach — free,
            right in your browser.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
            >
              Get started free
            </Link>
            <Link
              href="/about"
              className="rounded-lg border border-ink-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ink-700"
            >
              How it works
            </Link>
          </div>
        </header>

        {/* Features */}
        <section className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface-card p-6">
              <h2 className="font-display text-lg font-semibold text-white">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.body}</p>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="py-20">
          <h2 className="font-display text-center text-2xl font-semibold text-white">
            From 500 games to one clear plan
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="font-mono text-sm text-accent-400">{s.n}</span>
                <h3 className="font-display mt-2 text-xl font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-ink-600 pb-28 pt-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-white">
            Find out what&apos;s really costing you rating.
          </h2>
          <Link
            href="/register"
            className="mt-8 inline-block rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
          >
            Analyze my games
          </Link>
        </section>
      </div>
    </div>
  );
}
