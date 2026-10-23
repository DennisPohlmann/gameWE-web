import { currentAdmin } from "@/lib/auth";
import { getGame, getPlayerFlags } from "@/lib/data";
import { getGameEvents } from "@/lib/history";
import { getSettings } from "@/lib/settings";

// The latest events of a ranking as JSON, for the live box on its start page.
export async function GET(_req: Request, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!/^[a-z0-9_-]{1,32}$/i.test(game)) return new Response("not found", { status: 404 });
  if ((await getSettings()).gameEvents !== "live") return new Response("not found", { status: 404 });
  // Like the ranking pages: a hidden ranking for admins only.
  const known = (await getGame(game)) ?? ((await currentAdmin()) ? await getGame(game, true) : undefined);
  if (!known) return new Response("not found", { status: 404 });
  const rows = await getGameEvents(game, 10);
  const flags = await getPlayerFlags(rows.flatMap((r) => [r.actor, r.other]));
  return Response.json({ rows, flags: Object.fromEntries(flags) }, { headers: { "cache-control": "no-store" } });
}
