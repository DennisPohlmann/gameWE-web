import { api, apiPath, apiRankingRow, visibleGame } from "@/lib/api";
import { countryArg, pagingArg, paged, pathId, sortArg, textArg, bad } from "@/lib/api-params";
import { getRanking, rankingSorts, type RankingSort } from "@/lib/data";
import { getSettings } from "@/lib/settings";

const SORTS = Object.keys(rankingSorts) as RankingSort[];

// Players of a ranking, paged, with the filters of the website's ranking:
// country, state, city, clan and a name search.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "skill", ["name"]);
    const country = countryArg(q);
    const state = textArg(q, "state", 80);
    const city = textArg(q, "city", 80);
    const search = textArg(q, "q", 64);
    const rawClan = q.get("clan");
    const clan = rawClan === null ? null : pathId(rawClan);
    if (rawClan !== null && !clan) throw bad("invalid clan: clan ID");
    // The plain ranking numbers its rows; any other list gives each player's place in the whole ranking.
    const plain = sort === "skill" && !asc && !country && !state && !city && !search && !clan;
    const [{ activityDays }, ranking] = await Promise.all([
      getSettings(),
      getRanking({ game: game.code, sort, asc, search, limit: p.limit, offset: p.offset, country, state, city, clan: clan ?? undefined, withRank: !plain }),
    ]);
    const rows = ranking.rows.map((r, i) => apiRankingRow(r, plain ? p.offset + i + 1 : (r.globalRank ?? 0), activityDays));
    return paged(rows, Number(ranking.total), p, apiPath(`/rankings/${game.code}/players`), {
      sort: sort === "skill" ? undefined : sort,
      order: q.get("order") ?? undefined,
      country,
      state,
      city,
      clan: clan ?? undefined,
      q: search,
    });
  });
}
