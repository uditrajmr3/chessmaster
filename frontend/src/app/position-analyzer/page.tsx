"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import {
  Camera,
  Upload,
  Loader2,
  AlertTriangle,
  Check,
  KeyRound,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import TeachingBoard from "@/components/TeachingBoard";
import { Engine } from "@/lib/engine";
import { freeMove } from "@/lib/teaching";
import { coachReport, findThreats, ruleForMove } from "@/lib/coach";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { PositionAccess } from "@/lib/types";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")));
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

type Stage = "checking" | "locked" | "upload" | "reading" | "confirm";

export default function PositionAnalyzerPage() {
  const { user, refresh } = useAuth();
  const [access, setAccess] = useState<PositionAccess | null>(null);
  const [stage, setStage] = useState<Stage>("checking");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [fen, setFen] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAccess = async () => {
    try {
      const a = await api.getPositionAccess();
      setAccess(a);
      setStage(a.allowed ? "upload" : "locked");
    } catch {
      setAccess({ allowed: false, reason: "locked" });
      setStage("locked");
    }
  };

  useEffect(() => {
    void loadAccess();
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setStage("reading");
    try {
      const result = await api.analyzePosition(file);
      setFen(result.fen);
      setNotes(result.notes || null);
      setStage("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that image.");
      setStage("upload");
    }
  }

  async function handleUpgrade() {
    setUpgrading(true);
    setError(null);
    try {
      await loadRazorpayScript();
      const order = await api.createPremiumOrder();
      const razorpay = new window.Razorpay!({
        key: order.key_id,
        amount: order.amount_paise,
        currency: order.currency,
        order_id: order.order_id,
        name: "ChessInt Premium",
        description: "Unlock the AI Position Analyzer for 30 days",
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await api.verifyPremiumPayment(response);
            await refresh();
            await loadAccess();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment verification failed.");
          }
        },
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
    } finally {
      setUpgrading(false);
    }
  }

  if (stage === "checking") {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (stage === "locked") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <Header />
        <div className="surface-card space-y-4 p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" /> This feature uses the Claude API
          </p>
          <p className="text-sm leading-relaxed text-gray-400">
            Reading a position from a photo costs real AI-API money per use, so it's
            unlocked two ways — pick whichever suits you:
          </p>

          <div className="rounded-lg border border-white/10 bg-ink-800 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-white">
              <KeyRound className="h-4 w-4 text-accent-400" /> Use your own Anthropic API key
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Free forever — the cost goes to your own key, not ours.
            </p>
            <Link
              href="/settings"
              className="mt-3 inline-block rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-white/20"
            >
              Add key in Settings
            </Link>
          </div>

          <div className="rounded-lg border border-accent-500/30 bg-accent-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4 text-accent-300" /> Upgrade to Premium
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              One-time payment, 30 days of unlimited position analysis on us.
            </p>
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="mt-3 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 disabled:opacity-50 btn-press"
            >
              {upgrading ? "Starting checkout…" : "Upgrade — ₹149"}
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Header badge={access?.reason === "own_key" ? "Using your own API key" : "Premium"} />

      {stage === "upload" && (
        <div className="surface-card p-8">
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/15 py-14 text-center hover:border-accent-500/40 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-gray-500" />
            <p className="text-sm font-medium text-gray-300">
              Upload a screenshot or photo of a position
            </p>
            <p className="text-xs text-gray-500">PNG, JPEG, WEBP, or GIF — up to 10MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </div>
          {error && (
            <p className="mt-4 flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
        </div>
      )}

      {stage === "reading" && (
        <div className="surface-card flex flex-col items-center gap-3 p-14">
          <Loader2 className="h-6 w-6 animate-spin text-accent-400" />
          <p className="text-sm text-gray-400">Reading the position…</p>
        </div>
      )}

      {stage === "confirm" && fen && (
        <ConfirmAndAnalyze
          initialFen={fen}
          notes={notes}
          onStartOver={() => {
            setFen(null);
            setNotes(null);
            setStage("upload");
          }}
        />
      )}
    </div>
  );
}

function Header({ badge }: { badge?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Camera className="h-6 w-6 text-accent-400" />
        <h1 className="font-display text-2xl font-semibold text-white">
          Position Analyzer
        </h1>
      </div>
      {badge && (
        <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs text-gray-400">
          {badge}
        </span>
      )}
    </div>
  );
}

function ConfirmAndAnalyze({
  initialFen,
  notes,
  onStartOver,
}: {
  initialFen: string;
  notes: string | null;
  onStartOver: () => void;
}) {
  const [fen, setFen] = useState(initialFen);
  const [confirmed, setConfirmed] = useState(false);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [engineOffline, setEngineOffline] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [best, setBest] = useState<{ san: string; ruleId: string; ruleTitle: string; why: string } | null>(
    null
  );
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    return () => engineRef.current?.quit();
  }, []);

  function toggleSideToMove() {
    const parts = fen.split(" ");
    parts[1] = parts[1] === "w" ? "b" : "w";
    setFen(parts.join(" "));
  }

  function onPieceDrop(from: string, to: string): boolean {
    setFen((f) => freeMove(f, from, to));
    return true;
  }

  const chess = useMemo(() => {
    try {
      const c = new Chess(fen);
      setLegalError(null);
      return c;
    } catch {
      setLegalError(
        "This position isn't legal yet — check that each side has exactly one king and no pawns on the back rank."
      );
      return null;
    }
  }, [fen]);

  const report = useMemo(() => (chess ? coachReport(chess) : null), [chess]);
  const threatSquares = useMemo(
    () => (chess ? findThreats(chess).map((t) => t.square) : []),
    [chess]
  );
  const squareStyles: Record<string, React.CSSProperties> = {};
  for (const sq of threatSquares) {
    squareStyles[sq] = { backgroundColor: "rgba(220,60,60,0.45)" };
  }

  async function analyze() {
    if (!chess) return;
    setConfirmed(true);
    setThinking(true);
    try {
      if (!engineRef.current) {
        const e = new Engine();
        try {
          await e.init();
          engineRef.current = e;
        } catch {
          setEngineOffline(true);
        }
      }
      if (engineRef.current) {
        const { bestMoveUci } = await engineRef.current.bestMove(fen, { depth: 16 });
        if (bestMoveUci) {
          const from = bestMoveUci.slice(0, 2);
          const to = bestMoveUci.slice(2, 4);
          const tag = ruleForMove(chess, bestMoveUci);
          const tmp = new Chess(fen);
          const mv = tmp.move({ from, to, promotion: (bestMoveUci.slice(4) || "q") as "q" });
          setBest({
            san: mv?.san ?? bestMoveUci,
            ruleId: tag?.rule.id ?? "",
            ruleTitle: tag?.rule.title ?? "",
            why: tag?.why ?? "",
          });
        }
      }
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <TeachingBoard
          position={fen}
          allowDragging={!confirmed}
          onPieceDrop={onPieceDrop}
          squareStyles={confirmed ? squareStyles : {}}
          controls={["flip", "coords"]}
        />
        {legalError && (
          <p className="mt-3 flex items-center gap-2 text-sm text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {legalError}
          </p>
        )}
        {!confirmed && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={toggleSideToMove}
              className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm font-medium text-gray-300 hover:border-white/20 hover:text-white btn-press"
            >
              {fen.split(" ")[1] === "w" ? "White" : "Black"} to move — click to flip
            </button>
            <button
              onClick={analyze}
              disabled={!chess}
              className="rounded-lg bg-accent-500 px-5 py-2 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 disabled:opacity-40 btn-press"
            >
              Looks right — analyze
            </button>
          </div>
        )}
        {confirmed && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={onStartOver}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm font-medium text-gray-300 hover:border-white/20 hover:text-white btn-press"
            >
              <RefreshCw className="h-4 w-4" /> Analyze another position
            </button>
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        <div className="surface-card p-5">
          {!confirmed ? (
            <>
              <h3 className="font-display text-lg font-semibold text-white">
                Confirm the position
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                Drag any misread piece to fix it. AI reads a static image, so it can&rsquo;t
                always tell whose turn it is — use the toggle if it guessed wrong.
              </p>
              {notes && (
                <p className="mt-3 rounded-lg bg-white/[0.04] p-3 text-xs text-gray-400">
                  <span className="font-medium text-gray-300">Note from the reader: </span>
                  {notes}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-white">Your coach</h3>
                {report && (
                  <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs capitalize text-gray-400">
                    {report.phase}
                  </span>
                )}
              </div>

              {engineOffline && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  The engine didn&rsquo;t load, so there&rsquo;s no best-move suggestion — the
                  three-question checklist still works.
                </p>
              )}

              {report && (
                <ol className="mt-4 space-y-3">
                  {report.questions.map((q, i) => (
                    <li key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="flex items-center gap-2 text-sm font-medium text-white">
                        {q.ok ? (
                          <Check className="h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        )}
                        {i + 1}. {q.q}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-400">{q.answer}</p>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-4">
                {thinking ? (
                  <p className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding the best move…
                  </p>
                ) : best ? (
                  <div className="rounded-lg border border-green-700/40 bg-green-500/10 p-3">
                    <p className="text-sm font-semibold text-green-300">
                      Best move: {best.san}
                      {best.ruleId && (
                        <span className="ml-1 font-normal text-green-400/80">
                          — {best.ruleId}: {best.ruleTitle}
                        </span>
                      )}
                    </p>
                    {best.why && <p className="mt-1 text-xs text-gray-400">{best.why}</p>}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
