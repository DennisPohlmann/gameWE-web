import { api, apiPath, visibleGame } from "@/lib/api";
import { countryArg, pagingArg, paged, sortArg } from "@/lib/api-params";
import { apiPlace, PLACE_SORTS } from "@/lib/api-places";
import { getPlaceRanking } from "@/lib/data";
import { PLACE_SORT_DEFAULT } from "@/lib/sorts";

// Ranking of the states (optionally of one country): players, points and kills summed per state.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    const { sort, asc } = sortArg(q, PLACE_SORTS, PLACE_SORT_DEFAULT, ["name"]);
    const country = countryArg(q);
    const r = await getPlaceRanking({ game: game.code, kind: "state", country, sort, asc, limit: p.limit, offset: p.offset });
    return paged(
      r.rows.map((x, i) => apiPlace(game.code, x, p.offset + i + 1, "state")),
      r.total,
      p,
      apiPath(`/rankings/${game.code}/states`),
      { sort: sort === PLACE_SORT_DEFAULT ? undefined : sort, order: q.get("order") ?? undefined, country },
    );
  });
}
