import { api, apiRankingRow, codeOk, intParam } from "@/lib/api";
import { getGame, getRanking, getTotals } from "@/lib/data";
import { getSettings } from "@/lib/settings";

// One ranking: totals and the players by points (?limit=1..100, ?offset).
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = codeOk(code) ? await getGame(code) : undefined;
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const limit = intParam(q.get("limit"), 10, 1, 100);
    const offset = intParam(q.get("offset"), 0, 0, 100000);
    const [{ activityDays }, totals, ranking] = await Promise.all([
      getSettings(),
      getTotals(game.code),
      getRanking({ game: game.code, sort: "skill", asc: false, search: "", limit, offset }),
    ]);
    return {
      game: game.code,
      name: game.name,
      baseGame: game.realgame || null,
      totals: { players: totals.players, newPlayers24h: totals.newPlayers, kills: totals.kills, headshots: totals.headshots, servers: totals.servers },
      rankedPlayers: ranking.total,
      players: ranking.rows.map((r, i) => apiRankingRow(r, offset + i + 1, activityDays)),
    };
  });
}
