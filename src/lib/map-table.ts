// Sorting and per-minute values of the player table on a map page. Plain
// functions without database access, so `npm test` can run them.

// Column heads that sort; the SQL for each is in data.ts (getMapPlayerTable).
export const MAP_SORTS = ["kills", "deaths", "kpd", "hs", "hpk", "name", "position"] as const;
export type MapSort = (typeof MAP_SORTS)[number];

// The sort from ?sort and ?dir: unknown keys fall back to most kills first.
// Names read best A to Z and positions best first (1, 2, 3 …), numbers
// biggest first; ?dir=asc flips the default. desc is for the SQL: biggest
// value first (for "position" the best place first).
export function mapSort(rawSort: string, rawDir: string): { sort: MapSort; flipped: boolean; desc: boolean } {
  const sort = (MAP_SORTS as readonly string[]).includes(rawSort) ? (rawSort as MapSort) : "kills";
  const flipped = rawDir === "asc";
  const natural = sort === "name" || sort === "position" ? "asc" : "desc";
  // "position" ascending means the best place first, i.e. the most points.
  const asc = flipped !== (natural === "asc");
  const desc = sort === "position" ? asc : !asc;
  return { sort, flipped, desc };
}

// Kills per minute of play time; null without play time.
export function kpm(kills: number, seconds: number): number | null {
  return seconds > 0 ? kills / (seconds / 60) : null;
}
