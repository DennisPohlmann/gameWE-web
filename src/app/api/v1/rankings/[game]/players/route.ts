import { api, apiPath, apiRankingRow, RANKING_SORT_ALIASES, visibleGame } from "@/lib/api";
import { countryArg, enumArg, pagingArg, paged, pathId, sortArg, textArg, bad } from "@/lib/api-params";
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
    // view=inactive: the players the collector moved out of the ranking for
    // inactivity (the website's "Inactive players"), last seen first; they
    // have no place in the ranking and take no place filter.
    const view = enumArg(q, "view", ["ranked", "inactive"] as const, "ranked");
    const inactive = view === "inactive";
    const defSort = inactive ? "activity" : "skill";
    const { sort, asc } = sortArg(q, SORTS, defSort, ["name"], RANKING_SORT_ALIASES);
    const country = countryArg(q);
    const state = textArg(q, "state", 80);
    const city = textArg(q, "city", 80);
    if (inactive && (country || state || city)) throw bad("invalid view: inactive takes no country, state or city");
    const search = textArg(q, "q", 64);
    const rawClan = q.get("clan");
    const clan = rawClan === null ? null : pathId(rawClan);
    if (rawClan !== null && !clan) throw bad("invalid clan: clan ID");
    // position numbers the rows of this list, rank is the place in the whole ranking.
    const [{ activityDays }, ranking] = await Promise.all([
      getSettings(),
      getRanking({ game: game.code, sort, asc, search, limit: p.limit, offset: p.offset, country, state, city, clan: clan ?? undefined, withRank: !inactive, inactive }),
    ]);
    const rows = ranking.rows.map((r, i) => apiRankingRow(r, p.offset + i + 1, activityDays, !inactive));
    return paged(rows, Number(ranking.total), p, apiPath(`/rankings/${game.code}/players`), {
      view: inactive ? view : undefined,
      sort: sort === defSort ? undefined : sort,
      order: q.get("order") ?? undefined,
      country,
      state,
      city,
      clan: clan ?? undefined,
      q: search,
    });
  });
}
