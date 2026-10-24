import { api, visibleGame } from "@/lib/api";
import { intArg, pathId } from "@/lib/api-params";
import { getServer, getServerLoad } from "@/lib/data";
import { nowUnix } from "@/lib/format";

// Players on one server over the last `hours` hours, one point per 10 minutes.
export function GET(req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game, id } = await params;
    const serverId = pathId(id);
    if (!serverId || !(await visibleGame(game))) return null;
    const s = await getServer(serverId);
    if (!s || s.game.trim() !== game) return null;
    const hours = intArg(new URL(req.url).searchParams, "hours", 24, 1, 168);
    const load = await getServerLoad(s.serverId, nowUnix() - hours * 3600);
    return {
      game,
      id: s.serverId,
      hours,
      maxPlayers: s.max_players,
      data: load.map((l) => ({ time: l.timestamp, players: l.act_players, min: l.min_players, max: l.max_players, map: l.map || null })),
    };
  });
}
