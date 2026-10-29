import { api } from "@/lib/api";
import { botRankings, getGames, getPointSettings } from "@/lib/data";

// The point rules of the help page: the collector's point settings and,
// per ranking, whether it ranks bots and whether kills of bots give points.
// Action bonuses: /rankings/{game}/actions; weapon modifiers: /weapons.
export function GET() {
  return api(async () => {
    const [pts, bots, games] = await Promise.all([getPointSettings(), botRankings(), getGames()]);
    return {
      startPoints: pts.gamewe_start_skill,
      killPoints: pts.gamewe_kill_points,
      headshotBonus: pts.gamewe_headshot_bonus,
      suicidePenalty: pts.gamewe_suicide_penalty,
      teamkillPenalty: pts.gamewe_teamkill_penalty,
      rankings: games.map((g) => ({ game: g.code, botsRanked: bots(g.code), botKillPoints: bots.points(g.code) })),
    };
  });
}
