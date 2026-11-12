// The order of the ranking, the same everywhere (list, profile, banner, API,
// maps, collector hall of fame): most points, then most kills, then fewest
// deaths, then the lower player id (the older player). Places run on, no
// two players share one. A player without a kill and without a death has
// no place.

export type RankKey = { playerId: number; skill: number; kills: number; deaths: number };

// SQL: the players who have a place (index columns, so it stays in the index).
export const PLACED = "(kills > 0 OR deaths > 0)";

export const hasPlace = (p: { kills: number | string; deaths: number | string }) => Number(p.kills) > 0 || Number(p.deaths) > 0;

// Negative when a stands before b.
export function rankCompare(a: RankKey, b: RankKey): number {
  return b.skill - a.skill || b.kills - a.kills || a.deaths - b.deaths || a.playerId - b.playerId;
}

// SQL ORDER BY of the ranking order (desc) or its reverse; p is the table alias.
export function rankOrderSql(p: string, desc = true): string {
  const [hi, lo] = desc ? ["DESC", "ASC"] : ["ASC", "DESC"];
  return `${p}skill ${hi}, ${p}kills ${hi}, ${p}deaths ${lo}, ${p}playerId ${lo}`;
}

// Places of players from three counts (see rankPositions in data.ts):
// above = placed players with more points than the best of them, band =
// placed players per points value between the lowest and the best (the best
// included), same = the placed players at exactly the points of one of them.
export function placesFrom(players: RankKey[], above: number, band: { skill: number; n: number }[], same: RankKey[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of players) {
    if (!hasPlace(p)) continue;
    let ahead = above;
    for (const b of band) if (b.skill > p.skill) ahead += b.n;
    for (const s of same) if (s.skill === p.skill && rankCompare(s, p) < 0) ahead++;
    out.set(p.playerId, ahead + 1);
  }
  return out;
}
