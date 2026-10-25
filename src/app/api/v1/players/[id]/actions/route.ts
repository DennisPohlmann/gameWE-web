import { api, publicPlayer } from "@/lib/api";
import { pathId } from "@/lib/api-params";
import { getPlayerActions } from "@/lib/data";

// The actions a player triggered (the profile's actions table): how often
// and the points they brought, most often first.
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const actions = await getPlayerActions(p.playerId);
    return {
      id: p.playerId,
      game: p.game,
      data: actions.map((a) => ({ id: Number(a.id), description: a.description || null, count: Number(a.count), points: Number(a.points) })),
    };
  });
}
