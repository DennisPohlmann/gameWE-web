import { api, visibleGame } from "@/lib/api";
import { periodArg } from "@/lib/api-events";
import { EVENT_GROUPS, eventShares, eventStats, periodRange } from "@/lib/events-page";
import { nowUnix } from "@/lib/format";
import { getGameEventCounts } from "@/lib/history";
import { getSettings } from "@/lib/settings";

// The chart and the share table of the events page: events per group and
// chart step, and per type with its share of all.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const [game, { gameEvents }] = await Promise.all([visibleGame((await params).game), getSettings()]);
    if (!game || gameEvents === "off") return null;
    const period = periodArg(new URL(req.url).searchParams);
    const { from, step, n } = periodRange(period, nowUnix());
    const stats = eventStats(await getGameEventCounts(game.code, from, step), n);
    return {
      game: game.code,
      period,
      from,
      step,
      total: stats.total,
      types: eventShares(stats).map((s) => ({ type: s.type, count: s.n, share: Math.round(s.share * 10000) / 10000 })),
      groups: EVENT_GROUPS.map((g) => ({ group: g.id, types: [...g.kinds], counts: stats.series[g.id] })),
    };
  });
}
