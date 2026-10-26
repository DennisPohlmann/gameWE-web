// Career ranks (hlstats_Definition_Ranks_Ribbons, by kills): which rank a
// number of kills reaches and how far it is to the next one. No database
// here, so the tests can load it.

export type Rank = { index: number; name: string; minimum: number; next: number | null };

export function rankFor(kills: number, ranks: Rank[]): Rank | undefined {
  return [...ranks].reverse().find((r) => kills >= r.minimum);
}

// The way to the next rank: from the current rank's minimum (0 below the
// first rank) to the next one. Null at the highest rank or without ranks.
export function rankStep(kills: number, ranks: Rank[]): { next: Rank; needed: number; share: number } | null {
  const next = ranks.find((r) => kills < r.minimum);
  if (!next) return null;
  const from = rankFor(kills, ranks)?.minimum ?? 0;
  const share = Math.max(0, Math.min(1, (kills - from) / Math.max(1, next.minimum - from)));
  return { next, needed: next.minimum - kills, share };
}
