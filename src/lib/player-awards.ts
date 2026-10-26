// The player awards: award codes whose daily winner is the highest value of a
// column of the day's hlstats_Players_History row, whatever the award's type
// (as historyAwards in the collector). The columns go into SQL as written
// here, so they must stay constants.
export const PLAYER_AWARDS: Record<string, string> = {
  most_kills: "kills",
  most_deaths: "deaths",
  most_suicides: "suicides",
  most_headshots: "headshots",
  most_damage: "damage",
  most_improved: "skill_change",
  longest_playtime: "connection_time",
  longest_killstreak: "kill_streak",
  // HLstatsX:CE's award of the day's team kills (type W there, not a weapon)
  teamkills: "team_kills",
};
