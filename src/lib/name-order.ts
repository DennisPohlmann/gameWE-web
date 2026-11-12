// When a ranking sorted by name reads the names in order along the index
// lastName (collector schema 30) instead of sorting all its players: the
// rows of the index read for a page are about (offset + limit) / share of
// the players that match. Measured on 500,000 players: up to about 20,000
// rows that clearly beats the full sort (2 ms instead of 4.9 s for page 1 of a large
// ranking); a ranking with a small share or a deep page reads most of the
// index and is slower (up to 3.4 s instead of 27 ms), so it sorts as before.
// No imports, so the tests can load it directly.
export const NAME_INDEX_MAX_ROWS = 20_000;
// The estimate assumes the names spread evenly over the rankings. A page
// stops after this many examined rows (MariaDB's LIMIT ... ROWS EXAMINED,
// an index row and its player row count both) and is sorted the old way
// when it came back short: at worst about 0.1 s more. Not for a name search:
// its matches gather at one place of the alphabet (the caller leaves it out).
export const NAME_INDEX_MAX_EXAMINED = 40_000;

// matches: players of this list (the count), names: rows of hlstats_Players_Data.
export function nameIndexPays(offset: number, limit: number, matches: number, names: number): boolean {
  if (!(matches > 0) || !(names > 0)) return false;
  return ((offset + limit) * names) / matches <= NAME_INDEX_MAX_ROWS;
}
