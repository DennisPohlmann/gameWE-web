import "server-only";
import { adminExec, adminQuery, upsert } from "./db";
import { blockVacKey, blockVacOn, botSettingKeys, botSettingOn } from "./bot-settings";

// Admin side of the bot settings of one ranking (lib/bot-settings.ts):
// whether its bots are ranked, whether kills with bots give points and
// whether kills of bots count as kills.

export type RankingBots = { ranked: boolean; points: boolean; kills: boolean };

export async function rankingBots(game: string): Promise<RankingBots> {
  const k = botSettingKeys(game);
  const rows = await adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [[k.ranked, k.points, k.kills]]);
  const v = (key: string) => rows.find((r) => r.keyname === key)?.value;
  return { ranked: botSettingOn(v(k.ranked)), points: botSettingOn(v(k.points)), kills: botSettingOn(v(k.kills)) };
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
