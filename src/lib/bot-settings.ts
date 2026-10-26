// Bot settings per ranking in hlstats_Options, read by the collector every
// minute (collector internal/settings): gamewe_rank_bots_<game> (1: its bots
// are ranked like players; 0: hidden from the ranking and awards, no
// profile), gamewe_bot_points_<game> (1: kills with bots give points) and
// gamewe_bot_kills_<game> (1: a kill of a bot counts in the killer's kills,
// K/D and the kill-based ranks).
// A missing key means 1. Besides them the VAC block of the ranking:
// gamewe_block_vac_<game> (1: players with a VAC ban on record are kicked at
// connect and kept out of the ranking; a missing key means 0).
// No imports, so the tests can load it directly.

export const RANK_BOTS_PREFIX = "gamewe_rank_bots_";
export const BOT_POINTS_PREFIX = "gamewe_bot_points_";
export const BOT_KILLS_PREFIX = "gamewe_bot_kills_";

export const botSettingKeys = (game: string) => ({
  ranked: `${RANK_BOTS_PREFIX}${game}`,
  points: `${BOT_POINTS_PREFIX}${game}`,
  kills: `${BOT_KILLS_PREFIX}${game}`,
});

// A stored value as the collector reads it: missing = on; 0, false, no,
// off and empty = off.
export function botSettingOn(v: string | null | undefined): boolean {
  if (v === null || v === undefined) return true;
  return !["0", "false", "no", "off", ""].includes(v.trim().toLowerCase());
}

export const BLOCK_VAC_PREFIX = "gamewe_block_vac_";

export const blockVacKey = (game: string) => `${BLOCK_VAC_PREFIX}${game}`;

// The VAC block as the collector reads it: missing, 0, false, no, off and
// empty = off.
export function blockVacOn(v: string | null | undefined): boolean {
  return v !== null && v !== undefined && botSettingOn(v);
}
