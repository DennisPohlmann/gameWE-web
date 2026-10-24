import { api, apiLivePlayer, apiServer, visibleGame } from "@/lib/api";
import { getLivePlayers, getServer } from "@/lib/data";

// One server of a ranking with who is online.
export function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game, id } = await params;
    // Servers of hidden rankings are for admins only.
    if (!/^\d{1,10}$/.test(id) || !(await visibleGame(game))) return null;
    const s = await getServer(Number(id));
    if (!s || s.game.trim() !== game) return null;
    const live = await getLivePlayers(game, s.serverId);
    return { game, ...apiServer(s), online: live.map(apiLivePlayer) };
  });
}
