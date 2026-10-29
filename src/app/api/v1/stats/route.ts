import { api } from "@/lib/api";
import { intArg } from "@/lib/api-params";
import { everyDay, getActiveClansPerDay, getDailyActivityAll, getGeneralStats, getSiteTotals } from "@/lib/data";

// Totals over all rankings, the start page's general statistics and the
// activity per day.
export function GET(req: Request) {
  return api(async () => {
    const days = intArg(new URL(req.url).searchParams, "days", 30, 1, 365);
    const [totals, general, daily, clanDays] = await Promise.all([getSiteTotals(), getGeneralStats(), getDailyActivityAll(days), getActiveClansPerDay(days)]);
    const clans = new Map(clanDays.map((c) => [String(c.day).slice(0, 10), Number(c.n)]));
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
      general: {
        players: general.players,
        playersOnline: general.online,
        clans: general.clans,
        clanRankings: general.clanRankings,
        servers: general.servers,
        serversActive: general.serversActive,
        kills: general.kills,
        lastKill: general.lastKill,
        headshots: general.headshots,
      },
      days: everyDay(daily, days).map(({ day, point }) => ({
        day,
        players: point ? Number(point.players) : 0,
        kills: point ? Number(point.kills ?? 0) : 0,
        headshots: point ? Number(point.headshots ?? 0) : 0,
        activeClans: clans.get(day) ?? 0,
      })),
    };
  });
}
