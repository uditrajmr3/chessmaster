"use client";

// One mistake, explained in plain language: a board with arrows, a verdict line,
// and an optional "Try it" mode. The interactive board is lazy-loaded and only
// mounted once the user enters try mode. Spec: ux-overhaul section 2.3.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Chess } from "chess.js";
import { useTranslations } from "next-intl";
import MoveBoard from "@/components/insight/MoveBoard";
import ShowNumbers from "@/components/insight/ShowNumbers";
import NextStep from "@/components/insight/NextStep";
import Term from "@/components/Term";
import { ARROW_TONES } from "@/lib/boardTheme";
import { MATE_EVAL, verdict, type MistakeInput, type Verdict } from "@/lib/verdict";

const TeachingBoard = dynamic(() => import("@/components/TeachingBoard"), {
  ssr: false,
  loading: () => (
    <div className="aspect-square w-full animate-pulse rounded-lg bg-white/10" aria-hidden="true" />
  ),
});

export type MistakeCardMistake = MistakeInput & {
  game_id: string;
  move_number?: number;
  opponent?: string;
  date?: string;
  move_analysis_id?: string;
};

export interface MistakeCardProps {
  mistake: MistakeCardMistake;
  context?: ReactNode;
  defaultMode?: "view" | "try";
  onSolved?: (correct: boolean) => void;
  onNext?: () => void;
  compact?: boolean;
}

// Verdict keys whose message is an ICU select on the raw piece id (grammar
// agreement per language). All other keys take the translated pieces.<id> name.
const RAW_PIECE_KEYS = new Set(["verdict.hangsPiece"]);

/** Returns a function turning a verdict key + params into finished text. */
function useVerdictText() {
  const tv = useTranslations("verdict");
  const tp = useTranslations("pieces");
  const tm = useTranslations("motif");
  return (key: string, params: Record<string, string | number> = {}): string => {
    const out: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (k === "piece" && !RAW_PIECE_KEYS.has(key)) out[k] = tp(String(v));
      else if (k === "motif") out[k] = tm(`${v}.name`);
      else out[k] = v;
    }
    return tv(key.replace(/^verdict\./, ""), out);
  };
}

function safeVerdict(m: MistakeInput): Verdict | null {
  try {
    return verdict(m);
  } catch {
    return null;
  }
}

function validFen(fen: string): boolean {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

export function MistakeCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      data-testid="mistake-card-skeleton"
      aria-hidden="true"
      className="flex animate-pulse flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row"
    >
      <div className={`aspect-square w-full rounded-lg bg-white/10 ${compact ? "max-w-[280px]" : "max-w-[320px]"}`} />
      <div className="flex flex-1 flex-col gap-3">
        <div className="h-6 w-3/4 rounded bg-white/10" />
        <div className="h-4 w-1/2 rounded bg-white/10" />
        <div className="h-11 w-40 rounded bg-white/10" />
      </div>
    </div>
  );
}

const BTN =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300";
const BTN_PRIMARY = `${BTN} bg-accent-500 text-white hover:bg-accent-400`;
const BTN_GHOST = `${BTN} border border-white/20 text-white/85 hover:bg-white/10`;

function fmtEval(e: number | null | undefined, mate: string): string {
  if (e == null) return "-";
  if (Math.abs(e) >= MATE_EVAL) return mate;
  return `${e > 0 ? "+" : ""}${(e / 100).toFixed(2)}`;
}

export default function MistakeCard({
  mistake,
  context,
  defaultMode = "view",
  onSolved,
  onNext,
  compact = false,
}: MistakeCardProps) {
  const t = useTranslations("mistakeCard");
  const tc = useTranslations("plain");
  const tm = useTranslations("motif");
  const vText = useVerdictText();
  const inputId = useId();

  const v = useMemo(() => safeVerdict(mistake), [mistake]);
  const fenOk = useMemo(() => validFen(mistake.fen_before), [mistake.fen_before]);
  const best = mistake.best_move_uci?.toLowerCase() ?? null;
  const bestOk = !!best && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(best) && fenOk;
  const canTry = bestOk;

  const warned = useRef(false);
  useEffect(() => {
    if (!fenOk && !warned.current) {
      warned.current = true;
      console.warn("MistakeCard: invalid FEN, showing text-only row", mistake.game_id);
    }
  }, [fenOk, mistake.game_id]);

  type Phase = "playing" | "solved" | "revealed";
  const [mode, setMode] = useState<"view" | "try">(defaultMode === "try" && canTry ? "try" : "view");
  const [phase, setPhase] = useState<Phase>("playing");
  const [pos, setPos] = useState(mistake.fen_before);
  const [level, setLevel] = useState(0); // hint ladder: 0 none, 1 ring piece, 2 dot target, 3 answer offered
  const [wrong, setWrong] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [illegal, setIllegal] = useState(false);

  const primary = v ? vText(v.primaryKey, v.primaryParams) : "";
  const secondary = v?.secondaryKey ? vText(v.secondaryKey, v.secondaryParams) : "";
  const motifId =
    typeof v?.primaryParams.motif === "string" ? (v.primaryParams.motif as string) : null;
  const motifExplain = motifId && tm.has(`${motifId}.explain`) ? tm(`${motifId}.explain`) : "";
  const showChip = !!v && v.isSlip;

  const numbers = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-white/75">
      {mistake.move_san && (
        <>
          <dt className="text-white/50">{t("played")}</dt>
          <dd>{mistake.move_san}</dd>
        </>
      )}
      {mistake.best_move_san && (
        <>
          <dt className="text-white/50">{t("best")}</dt>
          <dd>{mistake.best_move_san}</dd>
        </>
      )}
      <dt className="text-white/50">
        <Term id="cpl">{t("lossLabel")}</Term>
      </dt>
      <dd>{Math.round(mistake.centipawn_loss)}</dd>
      <dt className="text-white/50">{t("evalLabel")}</dt>
      <dd>
        {fmtEval(mistake.eval_before, t("evalMate"))} {"->"} {fmtEval(mistake.eval_after, t("evalMate"))}
      </dd>
    </dl>
  );

  const metaParts: string[] = [];
  if (mistake.opponent) metaParts.push(t("meta.opponent", { opponent: mistake.opponent }));
  if (mistake.date) metaParts.push(mistake.date);
  if (mistake.move_number != null) metaParts.push(t("meta.move", { n: mistake.move_number }));

  const gameHref =
    `/games/${mistake.game_id}` + (mistake.move_number != null ? `?move=${mistake.move_number}` : "");

  const shell = `rounded-xl border border-white/10 bg-white/5 ${compact ? "p-3" : "p-4"}`;

  // Corrupt FEN: text-only row, never an error.
  if (!fenOk) {
    return (
      <div className={`${shell} flex flex-col gap-2`} data-testid="mistake-card-text">
        {primary && <p className="text-base font-semibold text-white">{primary}</p>}
        {metaParts.length > 0 && <p className="text-xs text-white/55">{metaParts.join(" · ")}</p>}
        {context && <div className="text-sm text-white/70">{context}</div>}
        <ShowNumbers>{numbers}</ShowNumbers>
      </div>
    );
  }

  const orientation = mistake.player_color;
  const ownColor = orientation === "white" ? "w" : "b";
  const bestFrom = bestOk ? best!.slice(0, 2) : null;
  const bestTo = bestOk ? best!.slice(2, 4) : null;

  function finish(ok: boolean, nextPos?: string) {
    if (nextPos) setPos(nextPos);
    setPhase(ok ? "solved" : "revealed");
    setSelected(null);
    onSolved?.(ok);
  }

  /** Returns true when the move is the engine's best move. */
  function attempt(from: string, to: string, promotion?: string): boolean {
    if (phase !== "playing" || !bestOk) return false;
    let mv;
    let after = "";
    try {
      const g = new Chess(mistake.fen_before);
      const promo =
        promotion ?? (g.get(from as never)?.type === "p" && /[18]$/.test(to) ? "q" : undefined);
      mv = g.move({ from, to, promotion: promo });
      after = g.fen();
    } catch {
      return false; // illegal: snap back, no penalty
    }
    const uci = `${mv.from}${mv.to}${mv.promotion ?? ""}`;
    if (uci === best) {
      finish(true, after);
      return true;
    }
    setWrong(true);
    setSelected(null);
    setLevel((l) => Math.min(3, l + 1));
    return false;
  }

  /** Typed entry: SAN (Nf3) or UCI (g1f3), checked against fen_before. */
  function submitTyped() {
    const text = typed.trim();
    if (!text || phase !== "playing") return;
    let from = "";
    let to = "";
    let promotion: string | undefined;
    try {
      const g = new Chess(mistake.fen_before);
      const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(text);
      const mv = uci
        ? g.move({ from: uci[1].toLowerCase(), to: uci[2].toLowerCase(), promotion: uci[3]?.toLowerCase() })
        : g.move(text);
      from = mv.from;
      to = mv.to;
      promotion = mv.promotion;
    } catch {
      setIllegal(true);
      return;
    }
    setIllegal(false);
    setTyped("");
    attempt(from, to, promotion);
  }

  function onSquareClick(square: string) {
    if (phase !== "playing") return;
    if (selected && selected !== square && attempt(selected, square)) return;
    try {
      const own = new Chess(pos).get(square as never)?.color === ownColor;
      setSelected(own && selected !== square ? square : null);
    } catch {
      setSelected(null);
    }
  }

  function enterTry() {
    setPos(mistake.fen_before);
    setPhase("playing");
    setLevel(0);
    setWrong(false);
    setSelected(null);
    setTyped("");
    setIllegal(false);
    setMode("try");
  }

  const rings: string[] = [];
  if (selected) rings.push(selected);
  if (level >= 1 && bestFrom && phase === "playing") rings.push(bestFrom);
  const dots = level >= 2 && bestTo && phase === "playing" ? [bestTo] : [];
  const squareStyles =
    phase === "solved" && bestTo
      ? { [bestTo]: { backgroundColor: "rgba(34,197,94,0.55)" } }
      : {};
  const answerArrows =
    phase === "revealed" && bestFrom && bestTo
      ? [{ startSquare: bestFrom, endSquare: bestTo, color: ARROW_TONES.good }]
      : [];

  let feedback = t("yourTurn");
  if (phase === "solved") feedback = `${t("correct")} ${primary}`.trim();
  else if (phase === "revealed")
    feedback = t("answerIs", { san: mistake.best_move_san ?? mistake.best_move_uci ?? "" });
  else if (wrong || level > 0) {
    const hint = level >= 2 ? t("hintSquare") : level === 1 ? t("hintPiece") : "";
    feedback = `${wrong ? t("notQuite") : ""} ${hint}`.trim();
  }

  const board =
    mode === "view" ? (
      <MoveBoard
        fen={mistake.fen_before}
        orientation={orientation}
        arrows={v?.arrows ?? []}
        highlights={v?.highlights ?? []}
        size={compact ? "sm" : "md"}
        ariaLabel={primary || mistake.move_san || mistake.fen_before}
        legend={!compact}
      />
    ) : (
      <div className={phase === "solved" ? "rounded-lg ring-2 ring-green-500/80 transition" : ""}>
        <TeachingBoard
          position={pos}
          initialOrientation={orientation}
          allowDragging={phase === "playing"}
          onPieceDrop={(from, to) => attempt(from, to)}
          onSquareClick={onSquareClick}
          dots={dots}
          rings={rings}
          squareStyles={squareStyles}
          arrows={answerArrows}
          controls={[]}
          maxWidth={compact ? 280 : 380}
        />
      </div>
    );

  return (
    <div className={`${shell} flex flex-col gap-4 ${compact ? "" : "sm:flex-row"}`} data-testid="mistake-card">
      <div className={`w-full shrink-0 ${compact ? "sm:max-w-[280px]" : "sm:max-w-[380px]"}`}>{board}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {mode === "view" ? (
          <>
            {primary && (
              <p className={`${compact ? "text-base" : "text-xl"} font-semibold leading-snug text-white`}>
                {primary}
              </p>
            )}
            {secondary && <p className="text-sm text-white/70">{secondary}</p>}
            {motifExplain && <p className="text-xs text-white/55">{motifExplain}</p>}
            {showChip && v && (
              <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-white/80">
                {tc(`cost.${v.cost}`)}
              </span>
            )}
            {metaParts.length > 0 && <p className="text-xs text-white/55">{metaParts.join(" · ")}</p>}
            {context && <div className="text-sm text-white/70">{context}</div>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {canTry && (
                <button type="button" className={BTN_PRIMARY} onClick={enterTry}>
                  {t("tryIt")}
                </button>
              )}
              <NextStep label={t("seeInGame")} href={gameHref} variant="inline" />
            </div>
            <ShowNumbers>{numbers}</ShowNumbers>
          </>
        ) : (
          <>
            <p
              aria-live="polite"
              data-testid="try-feedback"
              className={`${compact ? "text-base" : "text-lg"} font-semibold leading-snug ${
                phase === "solved" ? "text-green-400" : "text-white"
              }`}
            >
              {feedback}
            </p>
            {phase === "playing" && (
              <div className="flex flex-col gap-1">
                <label htmlFor={`${inputId}-typed`} className="text-xs text-white/60">
                  {t("typeMove")}
                </label>
                <input
                  id={`${inputId}-typed`}
                  type="text"
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    setIllegal(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitTyped();
                    }
                  }}
                  placeholder={t("typeMovePlaceholder")}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={illegal}
                  aria-describedby={illegal ? `${inputId}-illegal` : undefined}
                  className="min-h-11 w-full max-w-[260px] rounded-lg border border-white/20 bg-white/5 px-3 text-base text-white placeholder:text-white/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300"
                />
                {illegal && (
                  <p id={`${inputId}-illegal`} role="alert" className="text-sm text-red-400">
                    {t("illegalMove")}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {phase === "playing" && level < 3 && (
                <button type="button" className={BTN_GHOST} onClick={() => setLevel((l) => Math.min(3, l + 1))}>
                  {t("hint")}
                </button>
              )}
              {phase === "playing" && level >= 3 && (
                <button type="button" className={BTN_PRIMARY} onClick={() => finish(false)}>
                  {t("showAnswer")}
                </button>
              )}
              {phase !== "playing" && onNext && (
                <button type="button" className={BTN_PRIMARY} onClick={onNext}>
                  {t("next")}
                </button>
              )}
              <button type="button" className={BTN_GHOST} onClick={() => setMode("view")}>
                {t("backToView")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
