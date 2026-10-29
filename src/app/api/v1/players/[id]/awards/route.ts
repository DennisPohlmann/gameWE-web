import { api, apiPath, publicPlayer } from "@/lib/api";
import { pagingArg, paged, pathId, sortArg } from "@/lib/api-params";
import { getPlayerAwardWins } from "@/lib/history";
import { awardWinSorts, type AwardWinSort } from "@/lib/table-sort";

const SORTS = Object.keys(awardWinSorts) as AwardWinSort[];

// The daily awards a player won, newest first.
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const q = new URL(req.url).searchParams;
    const pg = pagingArg(q);
    // The sort fields of the website's awards page: date or award name.
    const { sort, asc } = sortArg(q, SORTS, "date", ["award"]);
    const { rows, total } = await getPlayerAwardWins(p.playerId, pg.limit, pg.offset, sort, asc);
    return paged(
      rows.map((a) => ({ day: String(a.date).slice(0, 10), id: Number(a.awardId), code: a.code, name: a.name, verb: a.verb, value: Number(a.winner_count) })),
      total,
      pg,
      apiPath(`/players/${p.playerId}/awards`),
      { sort: sort === "date" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
