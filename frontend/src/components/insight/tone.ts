import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";

export type InsightTone = "good" | "warn" | "bad" | "neutral";

/** Icon + border + text colour per tone. Colour is never the only signal: the icon shape differs too. */
export const TONE_STYLE: Record<
  InsightTone,
  { icon: LucideIcon; border: string; text: string }
> = {
  good: { icon: CheckCircle2, border: "border-l-green-400", text: "text-green-400" },
  warn: { icon: AlertTriangle, border: "border-l-yellow-400", text: "text-yellow-400" },
  bad: { icon: XCircle, border: "border-l-red-400", text: "text-red-400" },
  neutral: { icon: Info, border: "border-l-accent-400", text: "text-accent-300" },
};
