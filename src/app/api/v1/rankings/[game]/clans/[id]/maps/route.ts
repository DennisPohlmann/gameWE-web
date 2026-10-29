import { api, apiPath } from "@/lib/api";
import { clanMembers, publicClan } from "@/lib/api-clan";
import { kpd, share } from "@/lib/api-params";
import { getMembersMaps } from "@/lib/data";

// The members' kills and deaths per map (the clan page's map table, the 15
// maps with the most kills; a kill between two members counts both ways;
// without the bots' frags while the ranking keeps bots out of the stats).
export function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game, id } = await params;
    const found = await publicClan(game, id);
    if (!found) return null;
    const { ids } = await clanMembers(found.clan.clanId);
    const maps = await getMembersMaps(found.game.code, ids, 15);
    return {
      game: found.game.code,
      id: found.clan.clanId,
      data: maps.map((m) => ({
        id: Number(m.id),
        name: m.map,
        kills: Number(m.kills),
        deaths: Number(m.deaths),
        headshots: Number(m.headshots),
        kpd: kpd(m.kills, m.deaths),
        hpk: share(m.headshots, m.kills),
        url: apiPath(`/rankings/${found.game.code}/maps/${Number(m.id)}`),
      })),
    };
  });
}
