import { api } from "@/lib/api";
import { intArg } from "@/lib/api-params";
import { everyDay, getDailyActivityAll, getSiteTotals } from "@/lib/data";

// Totals over all rankings and the activity per day.
export function GET(req: Request) {
  return api(async () => {
    const days = intArg(new URL(req.url).searchParams, "days", 30, 1, 365);
    const [totals, daily] = await Promise.all([getSiteTotals(), getDailyActivityAll(days)]);
    return {
      totals: {
        rankings: Number(totals.games),
        servers: Number(totals.servers),
        players: Number(totals.players),
        clans: Number(totals.clans),
        kills: totals.kills,
        deaths: totals.deaths,
        headshots: totals.headshots,
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
