import { api, apiLoadPoint, visibleGame } from "@/lib/api";
import { intArg } from "@/lib/api-params";
import { getServerLoads, getServers } from "@/lib/data";
import { nowUnix } from "@/lib/format";

// The load of every server of a ranking in one answer: the graph of all
// servers on the ranking's start page (one point per server and 10 minutes).
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const game = await visibleGame((await params).game);
    if (!game) return null;
    const hours = intArg(new URL(req.url).searchParams, "hours", 24, 1, 168);
    const [servers, loads] = await Promise.all([getServers(game.code), getServerLoads(game.code, nowUnix() - hours * 3600)]);
    return {
      game: game.code,
      hours,
      data: servers.map((s) => ({ id: s.serverId, name: s.name, maxPlayers: s.max_players, load: (loads.get(s.serverId) ?? []).map(apiLoadPoint) })),
    };
  });
}
