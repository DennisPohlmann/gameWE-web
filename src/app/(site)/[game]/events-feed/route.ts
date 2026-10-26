import { overLimit } from "@/lib/api";
import { currentAdmin } from "@/lib/auth";
import { getGame, getPlayerFlags } from "@/lib/data";
import { kindsOf, periodParam, periodRange, typeParam } from "@/lib/events-page";
import { nowUnix } from "@/lib/format";
import { getGameEventListFeed, getGameEvents } from "@/lib/history";
import { noContent, nothingNew, sinceParam } from "@/lib/live-feed";
import { getSettings } from "@/lib/settings";

// Requests a client may make a minute with `?list=` (the events page asks
// every 4 seconds; a few open tabs fit).
const LIMIT = 60;

// The latest events of a ranking as JSON, for the live box on its start page.
// With `?list=` (empty or an event type of the events page's filter) and
// `&period=` (1h, 24h, 7d): the newest rows of the events page with that
// filter instead, for its live table.
// With `?since=<unix seconds>&seen=<n>` (the newest second the page knows
// and how many events of it): 204 and no body when there is nothing newer.
export async function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!/^[a-z0-9_-]{1,32}$/i.test(game)) return notFound();
  if ((await getSettings()).gameEvents !== "live") return notFound();
  const url = new URL(req.url);
  const list = url.searchParams.get("list");
  if (list !== null) {
    const wait = await overLimit("events-feed", LIMIT);
    if (wait) return new Response("rate limit", { status: 429, headers: { "retry-after": String(wait), "cache-control": "no-store" } });
  }
  // Like the ranking pages: a hidden ranking for admins only.
  const known = (await getGame(game)) ?? ((await currentAdmin()) ? await getGame(game, true) : undefined);
  if (!known) return notFound();
  const rows =
    list !== null
      ? await getGameEventListFeed(game, kindsOf(typeParam(list)), periodRange(periodParam(url.searchParams.get("period") ?? undefined), nowUnix()).from)
      : await getGameEvents(game, 10);
  if (nothingNew(rows, sinceParam(req.url))) return noContent();
  const flags = await getPlayerFlags(rows.flatMap((r) => [r.actor, r.other]));
  return Response.json({ rows, flags: Object.fromEntries(flags) }, { headers: { "cache-control": "no-store" } });
}

function notFound() {
  return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
}
