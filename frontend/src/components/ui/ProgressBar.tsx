/**
 * The only new UI primitive this feature adds (see design spec §5.6 — no
 * tabs/accordion/progress-bar abstraction existed before this). Server-safe:
 * no client hooks, so it can render inside server components too.
 */
export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-gray-400">
          <span>{label}</span>
          <span className="font-mono">
            {value}/{max}
          </span>
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-accent-950/50"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? "progress"}
      >
        <div
          className="progress-animated h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
