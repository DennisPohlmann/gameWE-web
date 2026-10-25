import { api, playerTags, publicPlayer } from "@/lib/api";
import { kpd, pathId, share } from "@/lib/api-params";
import { getPlayerKillStats } from "@/lib/data";

// Kill statistics as on the profile: everyone this player killed at least
// five times (at most 50, most kills first) with the kills against and
// deaths by each and the other player's place in the ranking. Hidden
// players are left out, bots stay.
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const stats = await getPlayerKillStats(p.playerId);
    const tag = await playerTags(stats.map((o) => o.playerId));
    const shown = stats.filter((o) => o.hideranking === 0 || tag(o.playerId).bot);
    return {
      id: p.playerId,
      game: p.game,
      minKills: 5,
      data: shown.map((o) => ({
        id: o.playerId,
        name: o.name,
        ...tag(o.playerId),
        rank: o.position,
        kills: o.kills,
        deaths: o.deaths,
        kpd: kpd(o.kills, o.deaths),
        headshots: o.headshots,
        hpk: share(o.headshots, o.kills),
      })),
    };
  });
}
