import { GAME_KINDS } from "./games";

// Which rankings are templates. A template is one of the rankings the
// database is seeded with (one per game: css, tf, csgo … as in HLstatsX:CE
// and the collector's seed), while it has no servers: it only holds the
// definitions (weapons, actions, awards, ranks) a new ranking copies. A
// ranking an admin created is never a template, also before its first
// server: it is listed with the rankings, takes servers of its game and can
// be chosen everywhere a ranking is. Run the tests with `npm test`.

// The ranking codes HLstatsX:CE's install.sql seeds besides the base games
// of GAME_KINDS (games gameWE does not support, or variants such as hl2ctf).
const SEEDED = ["hl2ctf", "insmod", "hidden", "aoc", "ges", "bg2", "sgtls", "dystopia", "nts", "pvkii", "nd", "dinodday"];

export function isSeededRanking(code: string): boolean {
  const c = code.trim().toLowerCase();
  return c in GAME_KINDS || SEEDED.includes(c);
}

export function isTemplateRanking(code: string, servers: number): boolean {
  return servers <= 0 && isSeededRanking(code);
}
