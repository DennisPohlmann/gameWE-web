import { api, apiLivePlayer, apiServer, visibleGame } from "@/lib/api";
import { pathId } from "@/lib/api-params";
import { getLivePlayers, getServer } from "@/lib/data";

// One server of a ranking with who is online.
export function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game: code, id } = await params;
    // Servers of hidden rankings are for admins only.
    const serverId = pathId(id);
    const game = await visibleGame(code);
    if (!serverId || !game) return null;
    const s = await getServer(serverId);
    if (!s || s.game.trim() !== game.code) return null;
    const live = await getLivePlayers(game.code, s.serverId);
    return { game: game.code, ...apiServer(s), online: live.map(apiLivePlayer) };
  });
}
