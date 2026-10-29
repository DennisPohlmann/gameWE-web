import { api, apiClan, apiPath, visibleGame } from "@/lib/api";
import { enumArg, pagingArg, paged, sortArg } from "@/lib/api-params";
import { clanSorts, countClans, countInactiveClans, getClanFlags, getClans, getInactiveClans, type ClanSort } from "@/lib/data";

const SORTS = Object.keys(clanSorts) as ClanSort[];

// Ranking of the clans with at least two ranked members, by average points.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    // view=inactive: clans with fewer than two active members (the website's
    // "Inactive clans"), last seen first, with the numbers of all members.
    const inactive = enumArg(q, "view", ["ranked", "inactive"] as const, "ranked") === "inactive";
    const defSort: ClanSort = inactive ? "activity" : "skill";
    const { sort, asc } = sortArg(q, SORTS, defSort, ["tag"], { points: "skill", avgPoints: "skill" });
    const [rows, total] = await Promise.all(
      inactive ? [getInactiveClans(game.code, p.limit, p.offset, sort, asc), countInactiveClans(game.code)] : [getClans(game.code, p.limit, p.offset, sort, asc), countClans(game.code)],
    );
    const flags = await getClanFlags(rows.map((c) => c.clanId), inactive);
    return paged(
      rows.map((c, i) => ({ rank: p.offset + i + 1, ...apiClan(c, flags.get(Number(c.clanId))) })),
      total,
      p,
      apiPath(`/rankings/${game.code}/clans`),
      { view: inactive ? "inactive" : undefined, sort: sort === defSort ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
