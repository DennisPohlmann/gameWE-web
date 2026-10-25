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

// Longest stretch one hlstats_server_load row stands for: the collector
// writes a row every 10 minutes (gameME every 5); a longer gap to the
// server's previous row means the server was down or not logging, so it
// counts as one interval only.
export const LOAD_INTERVAL_MAX = 600;

// Play time of a map: hlstats_Maps.play_time is only filled by imported
// gameME data (the collector never writes it), the load rows give the time
// the collector saw the map running with players; the larger one counts.
export function mapPlayTime(stored: number, fromLoad: number): number {
  const a = Number(stored);
  const b = Number(fromLoad);
  return Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0, 0);
}

// Kills per minute of play time; null without play time.
export function kpm(kills: number, seconds: number): number | null {
  return seconds > 0 ? kills / (seconds / 60) : null;
}
