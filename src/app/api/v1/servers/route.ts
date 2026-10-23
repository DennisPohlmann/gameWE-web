import { api, apiServer } from "@/lib/api";
import { getGames, getServers } from "@/lib/data";

// All servers of all rankings.
export function GET() {
  return api(async () => {
    const games = await getGames();
    const lists = await Promise.all(games.map((g) => getServers(g.code)));
    return games.flatMap((g, i) => lists[i].map((s) => ({ game: g.code, ...apiServer(s) })));
  });
}
