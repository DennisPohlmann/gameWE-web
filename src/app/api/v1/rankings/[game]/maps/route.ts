import { api, apiMap, apiPath, visibleGame } from "@/lib/api";
import { pageOf, pagingArg, paged, sortArg, sortRows } from "@/lib/api-params";
import { getMaps, type MapRow } from "@/lib/data";

const SORTS = ["kills", "headshots", "played", "time", "rounds", "name"] as const;
const key: Record<(typeof SORTS)[number], (m: MapRow) => number | string> = {
  kills: (m) => Number(m.kills),
  headshots: (m) => Number(m.headshots),
  played: (m) => Number(m.played),
  time: (m) => Number(m.play_time),
  rounds: (m) => Number(m.rounds),
  name: (m) => m.map,
};

// The maps of a ranking that were played, by kills.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "kills", ["name"]);
    const all = sortRows(await getMaps(game.code), key[sort], asc, (m) => Number(m.id));
    return paged(
      pageOf(all, p).map((m, i) => ({ rank: p.offset + i + 1, ...apiMap(m) })),
      all.length,
      p,
      apiPath(`/rankings/${game.code}/maps`),
      { sort: sort === "kills" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
