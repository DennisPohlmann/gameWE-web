import { api, apiPath, visibleGame } from "@/lib/api";
import { pageOf, pagingArg, paged, share, sortArg, sortRows } from "@/lib/api-params";
import { getWeapons, type WeaponRow } from "@/lib/data";

const SORTS = ["kills", "headshots", "hpk", "modifier", "name", "code"] as const;
const key: Record<(typeof SORTS)[number], (w: WeaponRow) => number | string> = {
  kills: (w) => Number(w.kills),
  headshots: (w) => Number(w.headshots),
  hpk: (w) => Number(w.headshots) / Math.max(1, Number(w.kills)),
  modifier: (w) => Number(w.modifier),
  name: (w) => w.name,
  code: (w) => w.code,
};

// The weapons of a ranking with kills, by kills.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "kills", ["name", "code"]);
    const all = sortRows(await getWeapons(game.code), key[sort], asc, (w) => Number(w.weaponId));
    const total = all.reduce((n, w) => n + Number(w.kills), 0);
    return paged(
      pageOf(all, p).map((w, i) => ({
        rank: p.offset + i + 1,
        code: w.code,
        name: w.name,
        modifier: Number(w.modifier),
        kills: Number(w.kills),
        headshots: Number(w.headshots),
        hpk: share(w.headshots, w.kills),
        killShare: share(w.kills, total),
      })),
      all.length,
      p,
      apiPath(`/rankings/${game.code}/weapons`),
      { sort: sort === "kills" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
