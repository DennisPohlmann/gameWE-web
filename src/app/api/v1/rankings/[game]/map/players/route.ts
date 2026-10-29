import { api, apiMapPlayer, visibleGame } from "@/lib/api";
import { countryArg, enumArg, textArg } from "@/lib/api-params";
import { getMapPlayers, getPlayerLiveServers } from "@/lib/data";
import { getSettings } from "@/lib/settings";

// The player map of the ranking (players page): the best players with a
// known place, the top 10 or (?show=all) up to 1000, optionally of one
// country, state or city, each at the GeoIP city point, with the server
// they are on right now. 404 while the site shows no player map.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const [game, { mapPlayers }] = await Promise.all([visibleGame((await params).game), getSettings()]);
    if (!game || !mapPlayers) return null;
    const q = new URL(req.url).searchParams;
    const show = enumArg(q, "show", ["top", "all"] as const, "top");
    const country = countryArg(q);
    const state = textArg(q, "state", 80);
    const city = textArg(q, "city", 80);
    const players = await getMapPlayers(game.code, show === "all" ? 1000 : 10, { country, state, city }, "skill");
    // As on the website: the current server only on the top 10 map.
    const online = show === "all" ? new Map() : await getPlayerLiveServers(game.code, players.map((p) => p.playerId));
    return { game: game.code, show, players: players.map((p) => apiMapPlayer({ ...p, ...online.get(p.playerId) })) };
  });
}
