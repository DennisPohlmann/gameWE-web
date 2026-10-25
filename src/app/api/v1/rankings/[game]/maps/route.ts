import { api, apiMap, apiPath, visibleGame } from "@/lib/api";
import { pageOf, pagingArg, paged, share, sortArg, sortRows } from "@/lib/api-params";
import { getMapWins, getMaps, type MapRow } from "@/lib/data";
import { SIDE_GAMES } from "@/lib/shares";

const SORTS = ["kills", "headshots", "hpk", "played", "time", "rounds", "name"] as const;
const key: Record<(typeof SORTS)[number], (m: MapRow) => number | string> = {
  kills: (m) => Number(m.kills),
  headshots: (m) => Number(m.headshots),
  hpk: (m) => share(m.headshots, m.kills) ?? 0,
  played: (m) => Number(m.played),
  time: (m) => Number(m.play_time),
  rounds: (m) => Number(m.rounds),
  name: (m) => m.map.toLowerCase(),
};

// The maps of a ranking that were played, by kills: the columns of the
// website's maps table (time, kills and headshots with their share of all
// maps, CT/T round wins).
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "kills", ["name"], { map: "name" });
    const [rows, wins] = await Promise.all([getMaps(game.code), getMapWins(game.code).catch(() => new Map<number, { ct: number; t: number }>())]);
    const all = sortRows(rows, key[sort], asc, (m) => Number(m.id));
    // As the maps page: round wins where a side wins rounds or wins exist.
    const sided = wins.size > 0 || SIDE_GAMES.has(game.realgame ?? "");
    const total = { time: 0, kills: 0, hs: 0 };
    for (const m of rows) {
      total.time += Number(m.play_time);
      total.kills += Number(m.kills);
      total.hs += Number(m.headshots);
    }
    return paged(
      pageOf(all, p).map((m, i) => ({
        rank: p.offset + i + 1,
        ...apiMap(m, sided ? (wins.get(Number(m.id)) ?? { ct: 0, t: 0 }) : undefined),
        timeShare: share(m.play_time, total.time),
        killShare: share(m.kills, total.kills),
        headshotShare: share(m.headshots, total.hs),
      })),
      all.length,
      p,
      apiPath(`/rankings/${game.code}/maps`),
      { sort: sort === "kills" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
