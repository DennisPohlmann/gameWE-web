// Bot settings per ranking in hlstats_Options, read by the collector every
// minute (collector internal/settings): gamewe_rank_bots_<game> (1: its bots
// are ranked like players; 0: hidden from the ranking and awards, no
// profile), gamewe_bot_points_<game> (1: kills with bots give points) and
// gamewe_bot_kills_<game> (1: a kill of a bot counts in the killer's kills,
// K/D and the kill-based ranks).
// A missing key means 1. No imports, so the tests can load it directly.

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
