import { api, apiPath, visibleGame } from "@/lib/api";
import { pageOf, pagingArg, paged, sortArg, sortRows } from "@/lib/api-params";
import { getActions, type ActionRow } from "@/lib/data";

const SORTS = ["count", "reward", "name"] as const;
const key: Record<(typeof SORTS)[number], (a: ActionRow) => number | string> = {
  count: (a) => Number(a.count),
  reward: (a) => Number(a.reward_player),
  name: (a) => a.description || a.code,
};

// The actions of a ranking (bomb planted, hostage rescued, ...) that happened, by count.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "count", ["name"]);
    const all = sortRows(await getActions(game.code), key[sort], asc, (a) => Number(a.id));
    return paged(
      pageOf(all, p).map((a, i) => ({
        rank: p.offset + i + 1,
        id: Number(a.id),
        code: a.code,
        description: a.description || null,
        team: a.team || null,
        rewardPlayer: Number(a.reward_player),
        rewardTeam: Number(a.reward_team),
        count: Number(a.count),
      })),
      all.length,
      p,
      apiPath(`/rankings/${game.code}/actions`),
      { sort: sort === "count" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
