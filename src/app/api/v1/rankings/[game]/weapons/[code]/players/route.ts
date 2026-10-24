import { api, apiPath, playerTags, visibleGame, weaponCodeOk } from "@/lib/api";
import { pagingArg, paged, share } from "@/lib/api-params";
import { countWeaponTop, getWeapon, getWeaponTop } from "@/lib/data";

// The best players with one weapon, by kills, paged.
export function GET(req: Request, { params }: { params: Promise<{ game: string; code: string }> }) {
  return api(async () => {
    const { game: g, code } = await params;
    const game = await visibleGame(g);
    if (!game || !weaponCodeOk(code)) return null;
    const w = await getWeapon(game.code, code);
    if (!w) return null;
    const p = pagingArg(new URL(req.url).searchParams);
    const [rows, total] = await Promise.all([getWeaponTop(w.weaponId, p.limit, p.offset), countWeaponTop(w.weaponId)]);
    const tag = await playerTags(rows.map((r) => r.playerId));
    return paged(
      rows.map((r, i) => ({
        rank: p.offset + i + 1,
        id: Number(r.playerId),
        name: r.name,
        ...tag(r.playerId),
        kills: Number(r.a),
        headshots: Number(r.b),
        shots: Number(r.c),
        hits: Number(r.d),
        hpk: share(r.b, r.a),
        accuracy: share(r.d, r.c),
      })),
      total,
      p,
      apiPath(`/rankings/${game.code}/weapons/${encodeURIComponent(w.code)}/players`),
    );
  });
}
