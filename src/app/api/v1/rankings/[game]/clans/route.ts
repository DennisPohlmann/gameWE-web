import { api, apiClan, apiPath, visibleGame } from "@/lib/api";
import { pagingArg, paged, sortArg } from "@/lib/api-params";
import { clanSorts, countClans, getClanFlags, getClans, type ClanSort } from "@/lib/data";

const SORTS = Object.keys(clanSorts) as ClanSort[];

// Ranking of the clans with at least two ranked members, by average points.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "skill", ["tag"]);
    const [rows, total] = await Promise.all([getClans(game.code, p.limit, p.offset, sort, asc), countClans(game.code)]);
    const flags = await getClanFlags(rows.map((c) => c.clanId));
    return paged(
      rows.map((c, i) => ({ rank: p.offset + i + 1, ...apiClan(c, flags.get(Number(c.clanId))) })),
      total,
      p,
      apiPath(`/rankings/${game.code}/clans`),
      { sort: sort === "skill" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
