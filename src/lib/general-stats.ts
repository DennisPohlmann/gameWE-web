// Counts of the start page's "General statistics" over the visible rankings
// (games with hidden = '0'). Players and clans count every row, not only what
// the lists show: the players of hlstats_Players and those the collector moved
// to hlstats_PlayersInactive (a player in both tables after a crash counts
// once), whatever their hideranking (hidden, banned, the old "inactive" 3), only
// bots left out; every clan of hlstats_Clans, also one without (active)
// members; kills and headshots of the players of both tables (a player in
// both counts once, from hlstats_Players). A count shows no player. No
// imports, so the tests can load it directly.

const visibleGame = (t: string) => `JOIN hlstats_Games g ON g.code = ${t}.game AND g.hidden = '0'`;
// One ranking (its page, also while hidden from the start page): one `?` per
// use, the ranking's code.
const oneGame = (t: string) => `JOIN hlstats_Games g ON g.code = ${t}.game AND g.code = ?`;

// Both tables, minus the players in both, minus the bots among them. Counted
// apart instead of a check per row: hlstats_PlayersInactive grows large, the
// overlap is found from hlstats_Players and the bots along the uniqueId index.
const playersSql = (scope: (t: string) => string) => `SELECT
  (SELECT COUNT(*) FROM hlstats_Players p ${scope("p")}) +
  (SELECT COUNT(*) FROM hlstats_PlayersInactive i ${scope("i")}) -
  (SELECT COUNT(*) FROM hlstats_Players p JOIN hlstats_PlayersInactive i ON i.playerId = p.playerId ${scope("p")}) -
  (SELECT COUNT(DISTINCT u.playerId) FROM hlstats_PlayerUniqueIds u ${scope("u")}
   WHERE u.uniqueId LIKE 'BOT%'
     AND (EXISTS (SELECT 1 FROM hlstats_Players p WHERE p.playerId = u.playerId)
       OR EXISTS (SELECT 1 FROM hlstats_PlayersInactive i WHERE i.playerId = u.playerId))) AS n`;

export const allPlayersSql = playersSql(visibleGame);
// The same for one ranking (the line at the top of its page): four `?`.
export const rankingPlayersSql = playersSql(oneGame);

export const allClansSql = `SELECT COUNT(*) AS clans, COUNT(DISTINCT c.game) AS rankings
  FROM hlstats_Clans c ${visibleGame("c")}`;

// The clans of one ranking as its public lists show them: every clan with at
// least two visible members in hlstats_Players and hlstats_PlayersInactive
// together, so the active and the inactive clans (data.ts). The collector
// makes a clan for every tag in a name and never deletes one, most of them
// have one member or none left. Two `?`, the ranking's code.
export const rankingClansSql = `SELECT COUNT(*) AS n FROM (SELECT m.clan FROM (
  SELECT clan FROM hlstats_Players WHERE game = ? AND hideranking = 0 AND clan > 0
  UNION ALL SELECT clan FROM hlstats_PlayersInactive WHERE game = ? AND hideranking = 0 AND clan > 0) m
  JOIN hlstats_Clans c ON c.clanId = m.clan GROUP BY m.clan HAVING COUNT(*) >= 2) x`;

// Kills and headshots of both tables, so they do not drop when the collector
// moves inactive players to hlstats_PlayersInactive. From the players, not
// the servers' counters: a reset of the player statistics sets them back to
// 0 (the servers' counters only go back with "All statistics").
const killsSql = (scope: (t: string) => string) => `SELECT SUM(t.kills) AS kills, SUM(t.headshots) AS headshots FROM (
  SELECT SUM(p.kills) AS kills, SUM(p.headshots) AS headshots FROM hlstats_Players p ${scope("p")}
  UNION ALL
  SELECT SUM(i.kills) AS kills, SUM(i.headshots) AS headshots FROM hlstats_PlayersInactive i ${scope("i")}
   WHERE NOT EXISTS (SELECT 1 FROM hlstats_Players p WHERE p.playerId = i.playerId)) t`;

export const allKillsSql = killsSql(visibleGame);
// The same for one ranking: two `?`.
export const rankingKillsSql = killsSql(oneGame);

// Players per ranking (Admin > Rankings), counted like the start page: both
// tables, minus the players in both, minus the bots, every hideranking.
// Grouped counts, added up by the caller (playersPerRanking).
export const playersPerRankingSql = {
  active: `SELECT TRIM(p.game) AS game, COUNT(*) AS n FROM hlstats_Players p GROUP BY TRIM(p.game)`,
  inactive: `SELECT TRIM(i.game) AS game, COUNT(*) AS n FROM hlstats_PlayersInactive i GROUP BY TRIM(i.game)`,
  both: `SELECT TRIM(p.game) AS game, COUNT(*) AS n FROM hlstats_Players p JOIN hlstats_PlayersInactive i ON i.playerId = p.playerId GROUP BY TRIM(p.game)`,
  bots: `SELECT TRIM(u.game) AS game, COUNT(DISTINCT u.playerId) AS n FROM hlstats_PlayerUniqueIds u
    WHERE u.uniqueId LIKE 'BOT%'
      AND (EXISTS (SELECT 1 FROM hlstats_Players p WHERE p.playerId = u.playerId)
        OR EXISTS (SELECT 1 FROM hlstats_PlayersInactive i WHERE i.playerId = u.playerId))
    GROUP BY TRIM(u.game)`,
};

type Counts = { game: string; n: number | string }[];

// active + inactive - both - bots per ranking.
export function playersPerRanking(r: { active: Counts; inactive: Counts; both: Counts; bots: Counts }): Map<string, number> {
  const m = new Map<string, number>();
  const add = (rows: Counts, sign: number) => {
    for (const x of rows) m.set(x.game, (m.get(x.game) ?? 0) + sign * Number(x.n));
  };
  add(r.active, 1);
  add(r.inactive, 1);
  add(r.both, -1);
  add(r.bots, -1);
  for (const [k, v] of m) m.set(k, Math.max(0, v));
  return m;
}

// The admin overview's "Players" card: its number is the sum of
// playersByRanking (every player of every ranking, as above); below it the
// hidden or banned ones and, on the "Active today" card, the players with an
// event since midnight (one `?`, Unix time), both of hlstats_Players and
// without bots (the collector hides bots, hideranking 1, so they made most
// of the hidden ones). The bots come along the uniqueId index, then their
// player by its key.
export const adminPlayerTotalsSql = `SELECT
  (SELECT COUNT(*) FROM hlstats_Players p WHERE p.hideranking <> 0) -
  (SELECT COUNT(*) FROM hlstats_PlayerUniqueIds u JOIN hlstats_Players p ON p.playerId = u.playerId AND p.hideranking <> 0
   WHERE u.uniqueId LIKE 'BOT%') AS hidden,
  (SELECT COUNT(*) FROM hlstats_Players p WHERE p.last_event >= ?) -
  (SELECT COUNT(*) FROM hlstats_PlayerUniqueIds u JOIN hlstats_Players p ON p.playerId = u.playerId AND p.last_event >= ?
   WHERE u.uniqueId LIKE 'BOT%') AS today`;
