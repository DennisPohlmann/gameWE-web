import { api, apiEvent, apiPath, playerTags, visibleGame } from "@/lib/api";
import { periodArg, typeArg } from "@/lib/api-events";
import { enumArg, pagingArg, paged, bad } from "@/lib/api-params";
import { MAX_LIST_ROWS, eventStats, kindsOf, periodRange } from "@/lib/events-page";
import { nowUnix } from "@/lib/format";
import { getGameEventCounts, getGameEventList } from "@/lib/history";
import { getSettings } from "@/lib/settings";

// The events page of a ranking: connects, team changes, actions, kills, ...
// of the last hour, 24 hours or 7 days, newest first, with its type filter.
// Never chat or addresses; events with a hidden or banned player are left
// out. 404 while the site has no events page.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const [game, { gameEvents }] = await Promise.all([visibleGame((await params).game), getSettings()]);
    if (!game || gameEvents === "off") return null;
    const q = new URL(req.url).searchParams;
    const period = periodArg(q);
    const type = typeArg(q);
    const order = enumArg(q, "order", ["desc", "asc"] as const, "desc");
    const pg = pagingArg(q);
    // As on the website: at most the first MAX_LIST_ROWS events of a list.
    if (pg.offset >= MAX_LIST_ROWS) throw bad(`invalid page: the list ends after ${MAX_LIST_ROWS} events, narrow type or period`);
    const { from, step, n } = periodRange(period, nowUnix());
    const stats = eventStats(await getGameEventCounts(game.code, from, step), n);
    const total = Math.min(type ? stats.byType[type] : stats.total, MAX_LIST_ROWS);
    const rows = await getGameEventList(game.code, kindsOf(type), from, Math.min(pg.limit, MAX_LIST_ROWS - pg.offset), pg.offset, order === "asc");
    const tags = await playerTags(rows.flatMap((r) => [Number(r.actor), Number(r.other)]));
    return paged(
      rows.map((e) => apiEvent(e, tags)),
      total,
      pg,
      apiPath(`/rankings/${game.code}/events`),
      { period: period === "24h" ? undefined : period, type, order: order === "desc" ? undefined : order },
    );
  });
}
