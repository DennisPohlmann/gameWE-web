import { api, apiMapPlayer } from "@/lib/api";
import { publicClan } from "@/lib/api-clan";
import { getClanMapPlayers } from "@/lib/data";
import { getSettings } from "@/lib/settings";

// The map of the clan page: every member with a known place (inactive ones
// marked), each at the GeoIP city point. 404 while the site shows no player map.
export function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game, id } = await params;
    const [found, { mapPlayers }] = await Promise.all([publicClan(game, id), getSettings()]);
    if (!found || !mapPlayers) return null;
    const players = await getClanMapPlayers(found.game.code, found.clan.clanId);
    return { game: found.game.code, id: found.clan.clanId, players: players.map(apiMapPlayer) };
  });
}
