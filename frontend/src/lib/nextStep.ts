/*
 * i18n note: for the "practisePhase" label, pass the phase through the lowercase
 * `nextStep.phase.{opening,middlegame,endgame}` words (NOT `plain.phase.*`, which is
 * capitalised and reads wrongly mid-sentence in English), e.g.
 *   t("nextStep.practisePhase", { phase: t(`nextStep.phase.${phase}`) })
 */
/** Build a filtered /puzzles link (the puzzles page reads `motif` and `phase`). */
export function puzzlesHref({ motif, phase }: { motif?: string; phase?: string } = {}): string {
  const params = new URLSearchParams();
  if (motif) params.set("motif", motif);
  if (phase) params.set("phase", phase);
  const qs = params.toString();
  return qs ? `/puzzles?${qs}` : "/puzzles";
}
