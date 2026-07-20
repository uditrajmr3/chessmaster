import type { Provenance } from "@/lib/awards/types";

const REPO = "uditrajmr3/chessmaster";

const LABEL: Record<Provenance, string> = {
  verified: "Verified",
  community: "Community-sourced",
  inferred: "Best guess",
};

const TITLE: Record<Provenance, string> = {
  verified: "Confirmed on an official Chess.com support page.",
  community: "Cross-referenced across independent fan sources.",
  inferred: "The name is known; the criteria are our best reading, not an official source.",
};

const TONE: Record<Provenance, string> = {
  verified: "border-green-500/25 bg-green-500/12 text-green-400",
  community: "border-accent-500/25 bg-accent-500/12 text-accent-300",
  inferred: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
};

/**
 * Every catalog entry carries a provenance tag (design spec §5.2) — never
 * present a fan-sourced or inferred criterion as fact. `inferred` entries
 * additionally link out to the correction issue template, since the repo
 * being public makes the dataset community-maintainable over time.
 */
export function ProvenanceBadge({
  provenance,
  awardName,
}: {
  provenance: Provenance;
  awardName?: string;
}) {
  const badge = (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${TONE[provenance]}`}
      title={TITLE[provenance]}
    >
      {LABEL[provenance]}
    </span>
  );

  if (provenance !== "inferred") return badge;

  const params = new URLSearchParams({ template: "award-correction.yml" });
  if (awardName) params.set("title", `Correction: ${awardName}`);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {badge}
      <a
        href={`https://github.com/${REPO}/issues/new?${params.toString()}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[0.65rem] text-accent-300 underline underline-offset-2 hover:text-accent-200"
      >
        Help us confirm this
      </a>
    </span>
  );
}
