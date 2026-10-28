import { overLimit } from "@/lib/api";
import { currentAdmin } from "@/lib/auth";
import { getClan, getClanMembers, getGame, getPlayerFlags } from "@/lib/data";
import { getMembersGameEvents, PLAYER_EVENTS } from "@/lib/history";
import { noContent, nothingNew, sinceParam } from "@/lib/live-feed";
import { getSettings } from "@/lib/settings";

// Requests a client may make a minute (the page asks every 4 seconds; a few
// open tabs fit).
const LIMIT = 60;

// The latest events with a member of one clan on either side as JSON, for
// the live box on the clan page: the same rows the page itself shows (the
// visible active members), and only where the page exists. With
// `?since=<unix seconds>&seen=<n>`: 204 and no body when there is nothing
// newer.
export async function GET(req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  const { game, id: raw } = await params;
  if (!/^[a-z0-9_-]{1,32}$/i.test(game) || !/^[1-9]\d{0,9}$/.test(raw)) return notFound();
  if ((await getSettings()).playerEvents !== "live") return notFound();
  const wait = await overLimit("clan-events-feed", LIMIT);
  if (wait) return new Response("rate limit", { status: 429, headers: { "retry-after": String(wait), "cache-control": "no-store" } });
  // Like the ranking pages (layout): a hidden ranking for admins only.
  const known = (await getGame(game)) ?? ((await currentAdmin()) ? await getGame(game, true) : undefined);
  if (!known) return notFound();
  const c = await getClan(Number(raw));
  if (!c || c.game !== game) return notFound();
  const ids = (await getClanMembers(c.clanId)).map((m) => Number(m.playerId));
  const rows = await getMembersGameEvents(c.clanId, ids, PLAYER_EVENTS);
  if (nothingNew(rows, sinceParam(req.url))) return noContent();
  const flags = await getPlayerFlags(rows.flatMap((r) => [r.actor, r.other]));
  return Response.json({ rows, flags: Object.fromEntries(flags) }, { headers: { "cache-control": "no-store" } });
}

function notFound() {
  return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
}
