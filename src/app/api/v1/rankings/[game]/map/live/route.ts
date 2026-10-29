import { api, apiMapPlayer, apiMapServer, visibleGame } from "@/lib/api";
import { getLiveMapPlayers, getMapServers } from "@/lib/data";
import { getSettings } from "@/lib/settings";

// The live map of the ranking's start page: the players online at the
// GeoIP city of their connection and the ranking's servers at theirs. 404
// while the site shows no live map.
export function GET(_req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const [game, { mapLive }] = await Promise.all([visibleGame((await params).game), getSettings()]);
    if (!game || !mapLive) return null;
    const [players, servers] = await Promise.all([getLiveMapPlayers(game.code), getMapServers(game.code)]);
    return { game: game.code, players: players.map(apiMapPlayer), servers: servers.map(apiMapServer) };
  });
}
