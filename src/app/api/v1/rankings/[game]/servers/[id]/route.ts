import { api, apiLivePlayer, apiServer, codeOk } from "@/lib/api";
import { getLivePlayers, getServer } from "@/lib/data";

// One server of a ranking with who is online.
export function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game, id } = await params;
    if (!codeOk(game) || !/^\d{1,10}$/.test(id)) return null;
    const s = await getServer(Number(id));
    if (!s || s.game.trim() !== game) return null;
    const live = await getLivePlayers(game, s.serverId);
    return { game, ...apiServer(s), online: live.map(apiLivePlayer) };
  });
}
