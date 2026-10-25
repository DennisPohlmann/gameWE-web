import { api, apiPath, visibleGame, weaponCodeOk } from "@/lib/api";
import { share } from "@/lib/api-params";
import { getWeapon } from "@/lib/data";

// One weapon of a ranking with its totals.
export function GET(_req: Request, { params }: { params: Promise<{ game: string; code: string }> }) {
  return api(async () => {
    const { game: g, code } = await params;
    const game = await visibleGame(g);
    if (!game || !weaponCodeOk(code)) return null;
    const w = await getWeapon(game.code, code);
    if (!w) return null;
    return {
      game: game.code,
      code: w.code,
      name: w.name?.trim() || w.code,
      modifier: Number(w.modifier),
      kills: Number(w.kills),
      headshots: Number(w.headshots),
      hpk: share(w.headshots, w.kills),
      playersUrl: apiPath(`/rankings/${game.code}/weapons/${encodeURIComponent(w.code)}/players`),
    };
  });
}
