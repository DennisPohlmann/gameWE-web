import { api, apiRadar } from "@/lib/api";
import { clanMembers, publicClan } from "@/lib/api-clan";
import { getMembersHistory, getRadarAverage } from "@/lib/data";

// The radar of the clan page: the members' last 14 days together against
// all players of the ranking active in them, as on the profile.
export function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game, id } = await params;
    const found = await publicClan(game, id);
    if (!found) return null;
    const { ids } = await clanMembers(found.clan.clanId);
    const [history, average] = await Promise.all([getMembersHistory(ids, 14), getRadarAverage(found.game.code)]);
    return { game: found.game.code, id: found.clan.clanId, ...apiRadar(history, average) };
  });
}
