// Sort keys of the player and place rankings and the SQL they order by.
// The SQL comes only from these maps; `sortParam` picks a key from the
// query string and falls back to the default for anything else.

export const rankingSorts = {
  skill: "p.skill",
  name: "d.lastName",
  activity: "p.last_event",
  time: "p.connection_time",
  kills: "p.kills",
  deaths: "p.deaths",
  kpd: "p.kills * 1.0 / GREATEST(p.deaths, 1)",
  hs: "p.headshots",
  hpk: "p.headshots * 1.0 / GREATEST(p.kills, 1)",
  acc: "p.hits * 1.0 / GREATEST(p.shots, 1)",
  new: "d.first_connect",
} as const;
export type RankingSort = keyof typeof rankingSorts;

// Columns of the summed place rows (see getPlaceRanking); skill is the total.
export const placeSorts = {
  players: "players",
  skill: "skill",
  avg: "avgSkill",
  kills: "kills",
  deaths: "deaths",
  kpd: "kills * 1.0 / GREATEST(deaths, 1)",
  hpk: "headshots * 1.0 / GREATEST(kills, 1)",
  time: "connection_time",
  name: "name",
} as const;
export type PlaceSort = keyof typeof placeSorts;

// The country and city rankings are ordered by total points by default.
export const PLACE_SORT_DEFAULT: PlaceSort = "skill";

// Own keys only, so "constructor" or "toString" never reach the SQL.
export function sortParam<K extends string>(sorts: Record<K, string>, raw: string, def: K): K {
  return Object.hasOwn(sorts, raw) ? (raw as K) : def;
}
