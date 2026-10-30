import "server-only";
import { adminExec, adminQuery } from "./db";
import { baseGameOf } from "./games";
import { playersPerRanking, playersPerRankingSql, rankingClansSql, rankingPlayersSql } from "./general-stats";
import { addParams } from "./return-to";

// Rankings (hlstats_Games rows) as the admin manages them: a new ranking takes
// its definitions from a template, and servers are moved between rankings by
// their hlstats_Servers.game.

// Definition tables copied from the template: [table, game column, copied columns].
const DEFINITIONS: [string, string, string[]][] = [
  ["hlstats_Weapons", "game", ["code", "name", "modifier"]],
  ["hlstats_Actions", "game", ["code", "reward_player", "reward_team", "team", "description", "for_PlayerActions", "for_PlayerPlayerActions", "for_TeamActions", "for_WorldActions"]],
  ["hlstats_Teams", "game", ["code", "name", "hidden"]],
  ["hlstats_Roles", "game", ["code", "name", "hidden"]],
  ["hlstats_Awards", "game", ["awardType", "code", "name", "verb"]],
  ["hlstats_Definition_Ranks_Ribbons", "game_code", ["definition_type", "code", "name", "img_file", "thumb_file", "minimum", "restriction_type"]],
  ["hlstats_Definition_Ribbons_Classes", "game_code", ["name", "maximum", "steps", "class"]],
];

// Copies the template's definitions to `code`; rows that already exist there
// (same code, for ranks the same type/name/code, for ribbon classes the same
// class) are left alone.
export async function copyDefinitions(code: string, template: string): Promise<number> {
  if (!template || template === code) return 0;
  let n = 0;
  for (const [table, gameCol, cols] of DEFINITIONS) {
    const key =
      table === "hlstats_Definition_Ranks_Ribbons" ? ["definition_type", "name", "code"] : table === "hlstats_Definition_Ribbons_Classes" ? ["class"] : ["code"];
    const res = await adminExec(
      `INSERT INTO ${table} (${gameCol}, ${cols.join(", ")})
       SELECT ?, ${cols.map((c) => `s.${c}`).join(", ")} FROM ${table} s
       WHERE s.${gameCol} = ? AND NOT EXISTS (
         SELECT 1 FROM ${table} x WHERE x.${gameCol} = ? AND ${key.map((k) => `x.${k} = s.${k}`).join(" AND ")})`,
      [code, template, code],
    );
    n += res.affectedRows;
  }
  return n;
}

export type AdminServer = { serverId: number; name: string; address: string; port: number; game: string };

export function allServers() {
  return adminQuery<AdminServer>(
    `SELECT serverId, name, address, port, TRIM(game) AS game FROM hlstats_Servers ORDER BY display_id, serverId`,
  );
}

// Base game per ranking code (see baseGameOf); the realgame column comes
// with the collector's init script (missing in older databases).
export async function rankingBaseGames(): Promise<Map<string, string | null>> {
  let rows: { code: string; realgame: string | null }[];
  try {
    rows = await adminQuery(`SELECT TRIM(code) AS code, TRIM(realgame) AS realgame FROM hlstats_Games`);
  } catch {
    rows = (await adminQuery<{ code: string }>(`SELECT TRIM(code) AS code FROM hlstats_Games`)).map((r) => ({ ...r, realgame: null }));
  }
  return new Map(rows.map((r) => [r.code, baseGameOf(r.code, r.realgame)]));
}

// Moves the given servers into ranking `code`. The collector picks the change
// up within a minute; players get new rows in that ranking from then on.
export async function assignServers(code: string, ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const res = await adminExec(`UPDATE hlstats_Servers SET game = ? WHERE serverId IN (?)`, [code, ids]);
  return res.affectedRows;
}

export type RankingSummary = { id: number; code: string; name: string; hidden: boolean; base: string | null; servers: number; order: number };

// Every ranking with its base game and number of servers, in display order
// (admin menu, overview and the list of rankings).
export async function rankingSummaries(): Promise<RankingSummary[]> {
  const [rows, servers, bases] = await Promise.all([
    adminQuery<{ id: number; code: string; name: string; hidden: string | number; display_id: number | string }>(
      `SELECT id, TRIM(code) AS code, name, hidden, display_id FROM hlstats_Games ORDER BY display_id, name`,
    ),
    adminQuery<{ game: string; n: number | string }>(`SELECT TRIM(game) AS game, COUNT(*) AS n FROM hlstats_Servers GROUP BY TRIM(game)`),
    rankingBaseGames(),
  ]);
  const count = new Map(servers.map((s) => [s.game, Number(s.n)]));
  return rows.map((r) => ({
    id: Number(r.id),
    code: r.code,
    name: r.name,
    hidden: String(r.hidden) === "1",
    base: bases.get(r.code) ?? null,
    servers: count.get(r.code) ?? 0,
    order: Number(r.display_id ?? 0),
  }));
}

// The rankings a reset applies to, as optionList("games"): those with at
// least one server. A ranking without servers is a template, which only holds
// the definitions for new rankings and is never reset (the collector refuses
// it too).
export async function resettableRankings(): Promise<[string, string][]> {
  const rows = await adminQuery<{ code: string; name: string }>(
    `SELECT TRIM(code) AS code, name FROM hlstats_Games WHERE TRIM(code) IN (SELECT TRIM(game) FROM hlstats_Servers) ORDER BY display_id, name`,
  );
  return rows.map((x) => [x.code, `${x.name} (${x.code})`]);
}

// All players of each ranking: also the inactive ones the collector moved
// to hlstats_PlayersInactive, hidden and banned ones, only bots left out
// (general-stats.ts, as on the start page).
export async function playersByRanking(): Promise<Map<string, number>> {
  type Rows = { game: string; n: number | string }[];
  const [active, inactive, both, bots] = await Promise.all(
    [playersPerRankingSql.active, playersPerRankingSql.inactive, playersPerRankingSql.both, playersPerRankingSql.bots].map((q) => adminQuery<Rows[number]>(q)),
  );
  return playersPerRanking({ active, inactive, both, bots } as { active: Rows; inactive: Rows; both: Rows; bots: Rows });
}

// The same for one ranking (its page).
export async function rankingPlayers(code: string): Promise<number> {
  const rows = await adminQuery<{ n: number | string }>(rankingPlayersSql, [code, code, code, code]);
  return Math.max(0, Number(rows[0]?.n ?? 0));
}

// The clans of one ranking that its public lists show (two members or more).
export async function rankingClans(code: string): Promise<number> {
  const rows = await adminQuery<{ n: number | string }>(rankingClansSql, [code, code]);
  return Number(rows[0]?.n ?? 0);
}

// Number of rows per ranking in one of the per-ranking tables. Table and
// column are constants of the callers, never input.
export async function countByRanking(table: string, column: string, where = ""): Promise<Map<string, number>> {
  const rows = await adminQuery<{ game: string; n: number | string }>(
    `SELECT TRIM(${column}) AS game, COUNT(*) AS n FROM ${table}${where ? ` WHERE ${where}` : ""} GROUP BY TRIM(${column})`,
  );
  return new Map(rows.map((r) => [r.game, Number(r.n)]));
}

// The notices a ranking's page shows after a save (saved=settings|servers,
// error=field|db with field and msg, serr=mismatch|db for the servers card).
const PAGE_PARAMS = ["saved", "error", "field", "msg", "serr"] as const;

// The admin page of ranking `gameId` (hlstats_Games.id), where it is edited,
// with the notices of a save and the card to jump to; the list of rankings
// when it does not exist. The code comes from the database, the parameters
// only from PAGE_PARAMS (no open redirect).
export async function rankingPageHref(gameId: string, params: Record<string, string | undefined> = {}, anchor?: "settings" | "servers"): Promise<string> {
  const rows = /^\d{1,10}$/.test(gameId) ? await adminQuery<{ code: string }>(`SELECT TRIM(code) AS code FROM hlstats_Games WHERE id = ?`, [Number(gameId)]) : [];
  if (!rows[0]) return "/admin/rankings";
  const keep: Record<string, string> = {};
  for (const k of PAGE_PARAMS) {
    const v = params[k];
    if (typeof v === "string" && v) keep[k] = v.slice(0, 300);
  }
  return `${addParams(`/admin/rankings/${encodeURIComponent(rows[0].code)}`, keep)}${anchor ? `#${anchor}` : ""}`;
}
