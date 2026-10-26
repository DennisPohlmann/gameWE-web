// Hidden players (hlstats_Players.hideranking <> 0: hidden by an admin or by
// the player with !hide, or marked as banned) appear nowhere on the public
// pages or in the public API: their own pages are 404 and every list leaves
// them out. Players banned in the ranking (2) are the exception on the bans
// page and their profile page with the ban notice (noProfile(p, true)). Bots are not hidden players. Only the live view of a server still
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

// An event list (latest events of a ranking or a player): rows with a hidden
// player on either side (actor and other: killer and victim, the target of
// an action) are left out, whatever the kind; bots stay. `people` are the
// loaded players of the rows; an actor not among them (moved away) drops the
// row. `self`, the player whose page it is, is never hidden (a hidden player
// has no page) and keeps rows where they are only the other side. The other
// side may be unknown: then it has no id and no name.
export type EventPerson = { playerId: number | string; name: string | null; hideranking: number | string | null; bot?: number | string | boolean | null };

export function shownEvents<T extends { actor: number | string; other: number | string }>(
  rows: T[],
  people: EventPerson[],
  limit: number,
  self = 0,
): (T & { actor: number; other: number; actorName: string | null; otherName: string | null })[] {
  const hidden = new Set(people.filter((x) => isHidden(x) && Number(x.playerId) !== self).map((x) => Number(x.playerId)));
  const visible = new Map(people.filter((x) => !hidden.has(Number(x.playerId))).map((x) => [Number(x.playerId), x.name]));
  return rows
    .filter((r) => !hidden.has(Number(r.actor)) && !hidden.has(Number(r.other)) && (visible.has(Number(r.actor)) || (self > 0 && Number(r.other) === self)))
    .slice(0, limit)
    .map((r) => {
      const actor = Number(r.actor);
      const other = Number(r.other);
      return {
        ...r,
        actor: visible.has(actor) ? actor : 0,
        actorName: visible.get(actor) ?? null,
        other: visible.has(other) ? other : 0,
        otherName: visible.get(other) ?? null,
      };
    });
}
