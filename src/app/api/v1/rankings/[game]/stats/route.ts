import { api, visibleGame } from "@/lib/api";
import { intArg } from "@/lib/api-params";
import { everyDay, getDailyActivity, getRankedCount, getTotals } from "@/lib/data";

// Totals of a ranking and its activity per day (players, kills, headshots).
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const days = intArg(new URL(req.url).searchParams, "days", 30, 1, 365);
    const [totals, ranked, daily] = await Promise.all([getTotals(game.code), getRankedCount(game.code), getDailyActivity(game.code, days)]);
    return {
      game: game.code,
      name: game.name,
      baseGame: game.realgame || null,
      totals: {
        players: totals.players,
        rankedPlayers: ranked,
        newPlayers24h: totals.newPlayers,
        kills: Number(totals.kills),
        headshots: Number(totals.headshots),
        servers: totals.servers,
      },
      days: everyDay(daily, days).map(({ day, point }) => ({
        day,
        players: point ? Number(point.players) : 0,
        kills: point ? Number(point.kills ?? 0) : 0,
        headshots: point ? Number(point.headshots ?? 0) : 0,
      })),
    };
  });
}
