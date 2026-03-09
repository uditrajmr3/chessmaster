"use client";

import type { GameFilters } from "@/lib/types";

const PLATFORMS = [
  { value: "", label: "All Platforms" },
  { value: "chesscom", label: "Chess.com" },
  { value: "lichess", label: "Lichess" },
];

const TIME_CLASSES = [
  { value: "", label: "All Time Controls" },
  { value: "bullet", label: "Bullet" },
  { value: "blitz", label: "Blitz" },
  { value: "rapid", label: "Rapid" },
  { value: "classical", label: "Classical" },
  { value: "daily", label: "Daily" },
];

export default function GameFilterBar({
  filters,
  onChange,
}: {
  filters: GameFilters;
  onChange: (filters: GameFilters) => void;
}) {
  return (
    <div className="flex gap-3">
      <select
        value={filters.platform || ""}
        onChange={(e) =>
          onChange({ ...filters, platform: e.target.value || undefined })
        }
        className="bg-[#222639] text-gray-300 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-accent-500 focus:outline-none"
      >
        {PLATFORMS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <select
        value={filters.time_class || ""}
        onChange={(e) =>
          onChange({ ...filters, time_class: e.target.value || undefined })
        }
        className="bg-[#222639] text-gray-300 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-accent-500 focus:outline-none"
      >
        {TIME_CLASSES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
