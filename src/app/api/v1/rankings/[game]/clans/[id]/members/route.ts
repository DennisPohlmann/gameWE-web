import { api, apiPath, apiRankingRow, RANKING_SORT_ALIASES, visibleGame } from "@/lib/api";
import { enumArg, pagingArg, paged, pathId, sortArg } from "@/lib/api-params";
import { getClan, getRanking, rankingSorts, type RankingSort } from "@/lib/data";
import { getSettings } from "@/lib/settings";

const SORTS = Object.keys(rankingSorts) as RankingSort[];

// The ranked members of a clan, paged; rank is each one's place in the whole ranking.
export function GET(req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game: code, id } = await params;
    const game = await visibleGame(code);
    const clanId = pathId(id);
    if (!game || !clanId) return null;
    const c = await getClan(clanId);
    if (!c || c.game !== game.code) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    // view=inactive: the members the collector moved out of the ranking
    // (listed below the others on the clan page), last seen first.
    const inactive = enumArg(q, "view", ["ranked", "inactive"] as const, "ranked") === "inactive";
    const defSort = inactive ? "activity" : "skill";
    const { sort, asc } = sortArg(q, SORTS, defSort, ["name"], RANKING_SORT_ALIASES);
    const [{ activityDays }, r] = await Promise.all([
      getSettings(),
      getRanking({ game: game.code, sort, asc, search: "", limit: p.limit, offset: p.offset, clan: clanId, withRank: !inactive, inactive }),
    ]);
    return paged(
      r.rows.map((x, i) => apiRankingRow(x, p.offset + i + 1, activityDays, !inactive)),
      Number(r.total),
      p,
      apiPath(`/rankings/${game.code}/clans/${clanId}/members`),
      { view: inactive ? "inactive" : undefined, sort: sort === defSort ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
