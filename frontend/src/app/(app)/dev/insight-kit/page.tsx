import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Chess } from "chess.js";
import PageAnswer from "@/components/insight/PageAnswer";
import InsightCard from "@/components/insight/InsightCard";
import LowData from "@/components/insight/LowData";
import NextStep from "@/components/insight/NextStep";
import AccuracyBadge from "@/components/insight/AccuracyBadge";
import MoveBoard from "@/components/insight/MoveBoard";
import MistakeCard, { type MistakeCardMistake } from "@/components/insight/MistakeCard";

// Dev-only preview of the shared insight kit. 404s in production builds.
export const metadata: Metadata = {
  title: "Insight kit preview",
  robots: { index: false, follow: false },
};

/** FEN after playing the given SAN moves from the start position. */
function after(sans: string[]): string {
  const g = new Chess();
  for (const s of sans) g.move(s);
  return g.fen();
}

const base = {
  game_id: "demo",
  player_color: "white" as const,
  classification: "blunder",
};

function fixtures(): { label: string; m: MistakeCardMistake }[] {
  return [
    {
      label: "allows mate",
      m: {
        ...base,
        game_id: "d1",
        move_number: 2,
        fen_before: after(["f3", "e5"]),
        move_uci: "g2g4",
        move_san: "g4",
        best_move_uci: "e2e4",
        best_move_san: "e4",
        eval_before: 0,
        eval_after: -9999,
        centipawn_loss: 900,
      },
    },
    {
      label: "missed mate",
      m: {
        ...base,
        game_id: "d2",
        move_number: 4,
        fen_before: after(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"]),
        move_uci: "d2d3",
        move_san: "d3",
        best_move_uci: "h5f7",
        best_move_san: "Qxf7#",
        eval_before: 9999,
        eval_after: 60,
        centipawn_loss: 900,
      },
    },
    {
      label: "missed fork",
      m: {
        ...base,
        game_id: "d3",
        move_number: 21,
        fen_before: "2q3k1/8/8/5N2/8/8/8/4K3 w - - 0 1",
        move_uci: "e1d2",
        move_san: "Kd2",
        best_move_uci: "f5e7",
        best_move_san: "Ne7+",
        eval_before: 300,
        eval_after: 0,
        centipawn_loss: 300,
        tactical_motifs: ["fork"],
      },
    },
    {
      label: "hangs piece",
      m: {
        ...base,
        game_id: "d4",
        move_number: 4,
        fen_before: after(["e4", "e5", "Nf3", "Nc6"]),
        move_uci: "f3e5",
        move_san: "Nxe5",
        best_move_uci: "f1b5",
        best_move_san: "Bb5",
        refutation_uci: "c6e5",
        eval_before: 30,
        eval_after: -190,
        centipawn_loss: 220,
      },
    },
    {
      label: "missed capture",
      m: {
        ...base,
        game_id: "d5",
        move_number: 30,
        fen_before: "4k3/8/8/3b4/8/2N5/8/4K3 w - - 0 1",
        move_uci: "e1d2",
        move_san: "Kd2",
        best_move_uci: "c3d5",
        best_move_san: "Nxd5",
        eval_before: 320,
        eval_after: 10,
        centipawn_loss: 310,
      },
    },
    {
      label: "small slip",
      m: {
        ...base,
        game_id: "d6",
        move_number: 9,
        classification: "inaccuracy",
        fen_before: after(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]),
        move_uci: "d2d3",
        move_san: "d3",
        best_move_uci: "c2c3",
        best_move_san: "c3",
        eval_before: 80,
        eval_after: 10,
        centipawn_loss: 70,
      },
    },
    {
      label: "turned the game",
      m: {
        ...base,
        game_id: "d7",
        move_number: 12,
        fen_before: after(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]),
        move_uci: "d2d3",
        move_san: "d3",
        best_move_uci: "c2c3",
        best_move_san: "c3",
        eval_before: 500,
        eval_after: -450,
        centipawn_loss: 950,
      },
    },
    {
      label: "no best move",
      m: {
        ...base,
        game_id: "d8",
        move_number: 15,
        classification: "mistake",
        fen_before: after(["d4", "d5", "c4", "e6"]),
        move_uci: "c4d5",
        move_san: "cxd5",
        best_move_uci: null,
        best_move_san: null,
        eval_before: 40,
        eval_after: -150,
        centipawn_loss: 190,
      },
    },
    {
      label: "invalid FEN",
      m: {
        ...base,
        game_id: "d9",
        move_number: 5,
        fen_before: "not a real fen",
        move_uci: "e2e4",
        move_san: "e4",
        best_move_uci: "d2d4",
        best_move_san: "d4",
        eval_before: 20,
        eval_after: -180,
        centipawn_loss: 200,
      },
    },
  ];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-white/10 pb-1 text-sm font-semibold uppercase tracking-wider text-white/60">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function InsightKitPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const cards = fixtures();
  const full = cards[3];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-white">Insight kit preview (dev only)</h1>

      <Section title="PageAnswer">
        <PageAnswer
          question="Where am I losing most?"
          answer="Most of your losses come from the middle of the game."
          tone="warn"
          action={{ label: "Practise puzzles like these", href: "/puzzles" }}
        />
      </Section>

      <Section title="InsightCard (4 tones)">
        <div className="grid gap-4 md:grid-cols-2">
          <InsightCard tone="good" headline="You convert winning positions well." detail="You won 9 of 10 games where you were clearly ahead." />
          <InsightCard tone="neutral" headline="You play the Italian most often." detail="It makes up about a third of your white games." />
          <InsightCard tone="warn" headline="You slow down in the endgame." detail="Your moves there take twice as long." />
          <InsightCard
            tone="bad"
            headline="Back-rank mates keep catching you."
            detail="It happened in 4 of your last 30 games."
            basedOn={30}
            action={{ label: "Practise back-rank mate puzzles", href: "/puzzles?motif=back_rank", reason: "Short drills fix this fastest." }}
            numbers={
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm text-white/75">
                <dt className="text-white/50">Games</dt>
                <dd>30</dd>
                <dt className="text-white/50">Affected</dt>
                <dd>4</dd>
              </dl>
            }
          />
        </div>
      </Section>

      <Section title="LowData (none / partial / enough)">
        <div className="grid gap-4 md:grid-cols-3">
          <LowData have={0} need={10} unit="games" unlocks="your recurring patterns" action={{ label: "Sync games", href: "/import" }}>
            <p>enough</p>
          </LowData>
          <LowData have={4} need={10} unit="analyzedGames" unlocks="your recurring patterns" action={{ label: "Analyze more games", href: "/games" }}>
            <p>enough</p>
          </LowData>
          <LowData have={12} need={10} unit="games">
            <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Enough data: children render here.</p>
          </LowData>
        </div>
      </Section>

      <Section title="NextStep (primary / inline / sticky)">
        <div className="flex flex-wrap items-center gap-4">
          <NextStep label="Practise fork puzzles" href="/puzzles?motif=fork" reason="You missed 3 forks this month." variant="primary" />
          <NextStep label="Replay this game" href="/games" variant="inline" />
        </div>
        <NextStep label="Sticky action (mobile bar)" href="/games" variant="primary" sticky />
      </Section>

      <Section title="AccuracyBadge">
        <div className="flex flex-wrap items-center gap-6">
          <AccuracyBadge value={87} source="chessint" basedOn={24} />
          <AccuracyBadge value={null} source={null} />
          <AccuracyBadge value={72} source="platform" platformName="Lichess" />
          <AccuracyBadge value={91} source="chessint" size="lg" />
        </div>
      </Section>

      <Section title="MistakeCard compact grid (9 fixtures)">
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(({ label, m }) => (
            <div key={m.game_id} className="flex flex-col gap-1">
              <p className="font-mono text-xs text-white/40">{label}</p>
              <MistakeCard mistake={m} compact />
            </div>
          ))}
        </div>
      </Section>

      <Section title="MistakeCard full size (hangs piece)">
        <MistakeCard mistake={full.m} context={<span>Preview context line.</span>} />
      </Section>

      <Section title="MoveBoard (black orientation)">
        <MoveBoard
          fen={after(["e4", "e5", "Nf3", "Nc6"])}
          orientation="black"
          arrows={[{ from: "g8", to: "f6", tone: "good" }]}
          highlights={[{ square: "e5", tone: "bad" }]}
          ariaLabel="Black-side board preview"
        />
      </Section>
    </main>
  );
}
