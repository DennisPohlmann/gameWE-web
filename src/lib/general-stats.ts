// Counts of the start page's "General statistics" over the visible rankings
// (games with hidden = '0'). Players and clans count every row, not only what
// the lists show: the players of hlstats_Players and those the collector moved
// to hlstats_PlayersInactive (a player in both tables after a crash counts
// once), whatever their hideranking (hidden, banned, the old "inactive" 3), only
// bots left out; every clan of hlstats_Clans, also one without (active)
// members. A count shows no player. No imports, so the tests can load it
// directly.

const visibleGame = (t: string) => `JOIN hlstats_Games g ON g.code = ${t}.game AND g.hidden = '0'`;

// Both tables, minus the players in both, minus the bots among them. Counted
// apart instead of a check per row: hlstats_PlayersInactive grows large, the
// overlap is found from hlstats_Players and the bots along the uniqueId index.
export const allPlayersSql = `SELECT
  (SELECT COUNT(*) FROM hlstats_Players p ${visibleGame("p")}) +
  (SELECT COUNT(*) FROM hlstats_PlayersInactive i ${visibleGame("i")}) -
  (SELECT COUNT(*) FROM hlstats_Players p JOIN hlstats_PlayersInactive i ON i.playerId = p.playerId ${visibleGame("p")}) -
  (SELECT COUNT(DISTINCT u.playerId) FROM hlstats_PlayerUniqueIds u ${visibleGame("u")}
   WHERE u.uniqueId LIKE 'BOT%'
     AND (EXISTS (SELECT 1 FROM hlstats_Players p WHERE p.playerId = u.playerId)
       OR EXISTS (SELECT 1 FROM hlstats_PlayersInactive i WHERE i.playerId = u.playerId))) AS n`;

export const allClansSql = `SELECT COUNT(*) AS clans, COUNT(DISTINCT c.game) AS rankings
  FROM hlstats_Clans c ${visibleGame("c")}`;
