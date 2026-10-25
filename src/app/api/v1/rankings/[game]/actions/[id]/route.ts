import { api, playerTags, visibleGame } from "@/lib/api";
import { pathId } from "@/lib/api-params";
import { getAction, getActionTop } from "@/lib/data";
import { actionBonus } from "@/lib/shares";

// One action of a ranking with its best players (most often first, at most
// 50, as the website's action page): how often each triggered it and the
// points it brought them.
export function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game: code, id } = await params;
    const game = await visibleGame(code);
    const actionId = pathId(id);
    if (!game || !actionId) return null;
    const a = await getAction(actionId);
    if (!a || a.game !== game.code) return null;
    const top = await getActionTop(a.id);
    const tag = await playerTags(top.map((r) => r.playerId));
    return {
      game: game.code,
      id: Number(a.id),
      code: a.code,
      description: a.description || null,
      team: a.team || null,
      bonus: actionBonus(a),
      rewardPlayer: Number(a.reward_player),
      rewardTeam: Number(a.reward_team),
      count: Number(a.count),
      players: top.map((r, i) => ({ position: i + 1, id: Number(r.playerId), name: r.name, ...tag(r.playerId), count: Number(r.a), points: Number(r.b) })),
    };
  });
}
