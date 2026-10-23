import "server-only";
import { adminExec, adminQuery } from "./db";
import { baseGameOf } from "./games";

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
