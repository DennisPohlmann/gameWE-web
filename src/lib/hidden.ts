// Hidden players (hlstats_Players.hideranking <> 0: hidden by an admin or by
// the player with !hide, or marked as banned) appear nowhere on the public
// pages or in the public API: their own pages are 404 and every list leaves
// them out. Bots are not hidden players. Only the live view of a server still
// lists them, without a link or id (see getLivePlayers). No imports, so the
// tests can load it directly.

// SQL condition: the player in column `col` is a bot (a BOT unique id). `col`
// is a constant column name, never input.
export const isBotSql = (col: string) =>
  `EXISTS (SELECT 1 FROM hlstats_PlayerUniqueIds hu WHERE hu.playerId = ${col} AND hu.uniqueId LIKE 'BOT%')`;

// SQL condition: the player in column `col` is hidden (hidden from the
// ranking and not a bot). A missing or deleted player is not hidden.
export const hiddenSql = (col: string) =>
  `EXISTS (SELECT 1 FROM hlstats_Players hp WHERE hp.playerId = ${col} AND hp.hideranking <> 0 AND NOT ${isBotSql("hp.playerId")})`;

// The same check on a loaded row (bot: 1 or true for a bot).
export function isHidden(p: { hideranking: number | string | null | undefined; bot?: number | string | boolean | null }): boolean {
  return Number(p.hideranking ?? 0) !== 0 && !Number(p.bot ?? 0);
}

// Live view of a server: a hidden player stays in the list with in-game name
// and live values, but without player id (no link, no id in the page).
export function liveEntry<T extends { player_id: number; is_bot: number | string }>(row: T, hideranking: number | string | null | undefined): T {
  return isHidden({ hideranking, bot: row.is_bot }) ? { ...row, player_id: 0 } : row;
}
