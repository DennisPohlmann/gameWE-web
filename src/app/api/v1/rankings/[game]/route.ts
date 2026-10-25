import { api, apiRankingRow, visibleGame } from "@/lib/api";
import { intArg, MAX_LIMIT, MAX_OFFSET } from "@/lib/api-params";
import { getRanking, getTotals } from "@/lib/data";
import { getSettings } from "@/lib/settings";

// One ranking: totals and the players by points (?limit=1..100, ?offset).
// Invalid values are refused with 400, as in the paged lists.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const limit = intArg(q, "limit", 10, 1, MAX_LIMIT);
    const offset = intArg(q, "offset", 0, 0, MAX_OFFSET);
    const [{ activityDays }, totals, ranking] = await Promise.all([
      getSettings(),
      getTotals(game.code),
      getRanking({ game: game.code, sort: "skill", asc: false, search: "", limit, offset, withRank: true }),
    ]);
    return {
      game: game.code,
      name: game.name,
      baseGame: game.realgame || null,
      totals: { players: totals.players, newPlayers24h: totals.newPlayers, kills: Number(totals.kills), headshots: Number(totals.headshots), servers: totals.servers },
      rankedPlayers: Number(ranking.total),
      players: ranking.rows.map((r, i) => apiRankingRow(r, offset + i + 1, activityDays)),
    };
  });
}
