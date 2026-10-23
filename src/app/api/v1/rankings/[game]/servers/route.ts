import { api, apiLivePlayer, apiServer, codeOk } from "@/lib/api";
import { getGame, getLivePlayers, getServers } from "@/lib/data";

// The servers of a ranking with who is online on each.
export function GET(_req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = codeOk(code) ? await getGame(code) : undefined;
    if (!game) return null;
    const [servers, live] = await Promise.all([getServers(game.code), getLivePlayers(game.code)]);
    return servers.map((s) => ({
      ...apiServer(s),
      online: live.filter((p) => p.server_id === s.serverId).map(apiLivePlayer),
    }));
  });
}
