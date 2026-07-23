import { readMeasurement } from "./measurements";
import type { AwardEntry, AwardStatus, Measurements } from "./types";

function numeric(raw: unknown, op: string): number | null {
  if (op === "set_size") return Array.isArray(raw) ? raw.length : null;
  if (op === "has_key") return raw === undefined || raw === null ? 0 : 1;
  return typeof raw === "number" ? raw : null;
}

function satisfied(value: number, op: string, target: number): boolean {
  switch (op) {
    case ">=": case "set_size": return value >= target;
    case ">":  return value > target;
    case "<=": return value <= target;
    case "<":  return value < target;
    case "==": return value === target;
    case "has_key": return value >= 1;
    default: return false;
  }
}

export function evaluate(
  catalog: AwardEntry[],
  measurements: Measurements | null,
  manual: Record<string, boolean>,
): AwardStatus[] {
  return catalog.map((a) => {
    if (!a.rule) {
      return { id: a.id, earned: Boolean(manual[a.id]), manual: true, progress: null };
    }
    if (!measurements) {
      return { id: a.id, earned: false, manual: false, progress: null };
    }

    const raw = readMeasurement(measurements, a.rule.measurement);

    // Membership check: earned iff the measurement is an array containing the
    // target. There is no meaningful "how close am I" for set membership, so
    // progress is always null — unlike set_size, this never shows a bar.
    if (a.rule.op === "contains") {
      const earned = Array.isArray(raw) && raw.includes(a.rule.target);
      return { id: a.id, earned, manual: false, progress: null };
    }

    const value = numeric(raw, a.rule.op);

    // A missing measurement is never a pass. `null <= target` is true in JS.
    if (value === null) {
      return { id: a.id, earned: false, manual: false, progress: null };
    }

    const target = a.rule.target as number;
    const earned = satisfied(value, a.rule.op, target);
    // Progress bars only make sense for accumulating rules.
    const showProgress = a.rule.op === ">=" || a.rule.op === ">" || a.rule.op === "set_size";
    return {
      id: a.id,
      earned,
      manual: false,
      progress: showProgress ? { current: value, target } : null,
    };
  });
}
