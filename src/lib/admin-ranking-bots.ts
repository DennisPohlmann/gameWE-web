import "server-only";
import { adminExec, adminQuery, upsert } from "./db";
import { blockVacKey, blockVacOn, botSettingKeys, botSettingOn, botStatsOn } from "./bot-settings";
import { ACCESS_SECRETS, FASTDL_ACCESS, accessKey, type Access, type AccessField } from "./fastdl-access";
import { FASTDL_URL_PREFIX } from "./overview-format";
import { deleteSecrets, saveSecret, secretsOf } from "./secret-options";

// Admin side of the bot settings of one ranking (lib/bot-settings.ts):
// whether its bots are ranked, whether kills with bots give points and
// whether kills of bots count for the career rank and whether kills with bots
// count in the players' stats.

export type RankingBots = { ranked: boolean; points: boolean; kills: boolean; stats: boolean };

export async function rankingBots(game: string): Promise<RankingBots> {
  const k = botSettingKeys(game);
  const rows = await adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [[k.ranked, k.points, k.kills, k.stats]]);
  const v = (key: string) => rows.find((r) => r.keyname === key)?.value;
  return { ranked: botSettingOn(v(k.ranked)), points: botSettingOn(v(k.points)), kills: botSettingOn(v(k.kills)), stats: botStatsOn(v(k.stats)) };
}

// Stores the settings. Turning the ranking of bots on or off also shows or
// hides the ranking's existing bots (hideranking 0 <-> 1; banned or
// self-hidden bots keep theirs), as `gamewe game set -rank-bots` does; the
// collector applies it to new bots within a minute. Returns the number of
// bots changed.
export async function saveRankingBots(game: string, next: RankingBots): Promise<number> {
  const k = botSettingKeys(game);
  const now = await rankingBots(game);
  const set = (key: string, on: boolean) => adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [key, on ? "1" : "0"]);
  await set(k.ranked, next.ranked);
  await set(k.points, next.points);
  await set(k.kills, next.kills);
  await set(k.stats, next.stats);
  if (now.ranked === next.ranked) return 0;
  const [from, to] = next.ranked ? [1, 0] : [0, 1];
  const r = await adminExec(
    `UPDATE hlstats_Players SET hideranking = ? WHERE game = ? AND hideranking = ?
     AND playerId IN (SELECT playerId FROM hlstats_PlayerUniqueIds WHERE game = ? AND uniqueId LIKE 'BOT:%')`,
    [to, game, from, game],
  );
  return r.affectedRows;
}

// The VAC block of one ranking (gamewe_block_vac_<game>, off by default).
// The collector applies a change within a minute; switched off, it ends the
// ranking's VAC records and their players are back in the ranking.
export async function rankingBlockVac(game: string): Promise<boolean> {
  const rows = await adminQuery<{ value: string | null }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, [blockVacKey(game)]);
  return blockVacOn(rows[0]?.value);
}

export async function saveRankingBlockVac(game: string, on: boolean): Promise<void> {
  await adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [blockVacKey(game), on ? "1" : "0"]);
}

// The FastDL address of one ranking (gamewe_fastdl_url_<game>): empty uses the
// global address, so no row is kept for it.
export async function rankingFastdl(game: string): Promise<string> {
  const rows = await adminQuery<{ value: string | null }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, [`${FASTDL_URL_PREFIX}${game}`]);
  return rows[0]?.value ?? "";
}

export async function saveRankingFastdl(game: string, url: string): Promise<void> {
  const key = `${FASTDL_URL_PREFIX}${game}`;
  if (url) await adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [key, url]);
  else await adminExec(`DELETE FROM hlstats_Options WHERE keyname = ?`, [key]);
}

// What one ranking's FastDL downloads send besides the address
// (lib/fastdl-access.ts): the plain fields, and only whether a secret is set.
export type RankingFastdlAccess = { agent: string; referer: string; user: string; password: boolean; token: boolean; header: boolean };

export async function rankingFastdlAccess(game: string): Promise<RankingFastdlAccess> {
  const plain = FASTDL_ACCESS.filter((f) => !ACCESS_SECRETS.includes(f));
  const [rows, secrets] = await Promise.all([
    adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [plain.map((f) => accessKey(f, game))]),
    secretsOf(ACCESS_SECRETS.map((f) => accessKey(f, game))),
  ]);
  const v = Object.fromEntries(rows.map((r) => [r.keyname, r.value ?? ""]));
  const set = (f: AccessField) => Boolean(secrets[accessKey(f, game)]);
  return { agent: v[accessKey("agent", game)] ?? "", referer: v[accessKey("referer", game)] ?? "", user: v[accessKey("user", game)] ?? "", password: set("password"), token: set("token"), header: set("header") };
}

// Plain fields: empty removes the row. Secrets: undefined or empty keeps the
// stored one, a name in clear removes it.
export async function saveRankingFastdlAccess(game: string, a: Access, clear: AccessField[]): Promise<void> {
  for (const f of FASTDL_ACCESS) {
    const key = accessKey(f, game);
    const v = a[f] ?? "";
    if (ACCESS_SECRETS.includes(f)) {
      if (clear.includes(f)) await deleteSecrets([key]);
      else if (v) await saveSecret(key, v);
    } else if (v) await adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [key, v]);
    else await adminExec(`DELETE FROM hlstats_Options WHERE keyname = ?`, [key]);
  }
}
