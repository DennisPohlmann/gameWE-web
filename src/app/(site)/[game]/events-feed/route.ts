import { currentAdmin } from "@/lib/auth";
import { getGame, getPlayerFlags } from "@/lib/data";
import { getGameEvents } from "@/lib/history";
import { noContent, nothingNew, sinceParam } from "@/lib/live-feed";
import { getSettings } from "@/lib/settings";

// The latest events of a ranking as JSON, for the live box on its start page.
// With `?since=<unix seconds>&seen=<n>` (the newest second the page knows
// and how many events of it): 204 and no body when there is nothing newer.
export async function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!/^[a-z0-9_-]{1,32}$/i.test(game)) return new Response("not found", { status: 404 });
  if ((await getSettings()).gameEvents !== "live") return new Response("not found", { status: 404 });
  // Like the ranking pages: a hidden ranking for admins only.
  const known = (await getGame(game)) ?? ((await currentAdmin()) ? await getGame(game, true) : undefined);
  if (!known) return new Response("not found", { status: 404 });
  const rows = await getGameEvents(game, 10);
  if (nothingNew(rows, sinceParam(req.url))) return noContent();
  const flags = await getPlayerFlags(rows.flatMap((r) => [r.actor, r.other]));
  return Response.json({ rows, flags: Object.fromEntries(flags) }, { headers: { "cache-control": "no-store" } });
}
