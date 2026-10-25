import { api, apiPath, visibleGame } from "@/lib/api";
import { pageOf, pagingArg, paged, share, sortArg, sortRows } from "@/lib/api-params";
import { getActions, type ActionRow } from "@/lib/data";
import { actionBonus, actionName } from "@/lib/shares";

const SORTS = ["count", "reward", "name"] as const;
const key: Record<(typeof SORTS)[number], (a: ActionRow) => number | string> = {
  count: (a) => Number(a.count),
  reward: (a) => actionBonus(a),
  name: (a) => actionName(a).toLowerCase(),
};

// The actions of a ranking (bomb planted, hostage rescued, ...) that
// happened, by count: the columns of the website's actions table (points
// bonus, count and its share of all actions).
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "count", ["name"], { bonus: "reward" });
    const rows = await getActions(game.code);
    const total = rows.reduce((n, a) => n + Number(a.count), 0);
    const all = sortRows(rows, key[sort], asc, (a) => Number(a.id));
    return paged(
      pageOf(all, p).map((a, i) => ({
        rank: p.offset + i + 1,
        id: Number(a.id),
        code: a.code,
        description: a.description || null,
        team: a.team || null,
        // The website's "points bonus": the player reward, else the team reward.
        bonus: actionBonus(a),
        rewardPlayer: Number(a.reward_player),
        rewardTeam: Number(a.reward_team),
        count: Number(a.count),
        share: share(a.count, total),
        playersUrl: apiPath(`/rankings/${game.code}/actions/${a.id}`),
      })),
      all.length,
      p,
      apiPath(`/rankings/${game.code}/actions`),
      { sort: sort === "count" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
