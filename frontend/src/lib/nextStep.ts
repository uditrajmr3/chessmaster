/** Build a filtered /puzzles link (the puzzles page reads `motif` and `phase`). */
export function puzzlesHref({ motif, phase }: { motif?: string; phase?: string } = {}): string {
  const params = new URLSearchParams();
  if (motif) params.set("motif", motif);
  if (phase) params.set("phase", phase);
  const qs = params.toString();
  return qs ? `/puzzles?${qs}` : "/puzzles";
}
