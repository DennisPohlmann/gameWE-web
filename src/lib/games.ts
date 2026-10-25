// The base games a ranking can be (hlstats_Games.realgame, as in HLstatsX:CE).
// A ranking such as "assault" has realgame "css"; the collector reads the log
// format from it, the website shows the game's name and short tag.

// limited: the collector records kills, connects and teams, but has no
// template definitions (weapons, actions, awards) for it yet.
// noShots: the logs have no shots (Counter-Strike 2 has no weaponstats
// plugin), so shots, hits and accuracy are left out; damage and the hit zones
// come from the attacked lines.
export type GameKind = { name: string; short: string; engine: "goldsrc" | "source" | "source2"; limited?: boolean; noShots?: boolean };

export const GAME_KINDS: Record<string, GameKind> = {
  css: { name: "Counter-Strike: Source", short: "CS:S", engine: "source" },
  csgo: { name: "Counter-Strike: Global Offensive", short: "CS:GO", engine: "source" },
  cs2: { name: "Counter-Strike 2", short: "CS2", engine: "source2", noShots: true },
  cstrike: { name: "Counter-Strike 1.6", short: "CS 1.6", engine: "goldsrc" },
  tf: { name: "Team Fortress 2", short: "TF2", engine: "source" },
  tfc: { name: "Team Fortress Classic", short: "TFC", engine: "goldsrc" },
  hl2mp: { name: "Half-Life 2 Deathmatch", short: "HL2DM", engine: "source" },
  valve: { name: "Half-Life Deathmatch", short: "HLDM", engine: "goldsrc" },
  dods: { name: "Day of Defeat: Source", short: "DoD:S", engine: "source" },
  dod: { name: "Day of Defeat", short: "DoD", engine: "goldsrc" },
  ns: { name: "Natural Selection", short: "NS", engine: "goldsrc" },
  l4d: { name: "Left 4 Dead", short: "L4D", engine: "source", limited: true },
  l4d2: { name: "Left 4 Dead 2", short: "L4D2", engine: "source", limited: true },
  insurgency: { name: "Insurgency", short: "INS", engine: "source", limited: true },
  zps: { name: "Zombie Panic! Source", short: "ZPS", engine: "source" },
  ff: { name: "Fortress Forever", short: "FF", engine: "source" },
  csp: { name: "CSPromod", short: "CSP", engine: "source" },
  fof: { name: "Fistful of Frags", short: "FoF", engine: "source" },
  nmrih: { name: "No More Room in Hell", short: "NMRiH", engine: "source", limited: true },
};

export function gameKind(realgame: string | null | undefined): GameKind | null {
  return GAME_KINDS[(realgame ?? "").trim().toLowerCase()] ?? null;
}

// Base game of a ranking: its realgame, else the code itself when that is a
// base game (the seeded rankings css, tf …), else unknown.
export function baseGameOf(code: string | null | undefined, realgame: string | null | undefined): string | null {
  const r = (realgame ?? "").trim().toLowerCase();
  if (GAME_KINDS[r]) return r;
  const c = (code ?? "").trim().toLowerCase();
  return GAME_KINDS[c] ? c : null;
}

// SQL condition on hlstats_Games: the ranking has a server or a player. The
// seeded rankings (cstrike, csgo, dod …) without either are left out of the
// ranking choices.
export const GAME_HAS_DATA = `(EXISTS (SELECT 1 FROM hlstats_Servers s WHERE s.game = hlstats_Games.code)
  OR EXISTS (SELECT 1 FROM hlstats_Players p WHERE p.game = hlstats_Games.code))`;

// Servers of different base games must not share a ranking (different log
// formats, weapons and actions). Unknown games are not blocked.
export function sameBaseGame(a: string | null, b: string | null): boolean {
  return !a || !b || a === b;
}
