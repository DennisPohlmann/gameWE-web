import { api, apiClan, apiPath, visibleGame } from "@/lib/api";
import { pathId } from "@/lib/api-params";
import { getClan, getClanFlags } from "@/lib/data";

// One clan of a ranking with its totals (ranked members only).
export function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game: code, id } = await params;
    const game = await visibleGame(code);
    const clanId = pathId(id);
    if (!game || !clanId) return null;
    const c = await getClan(clanId);
    if (!c || c.game !== game.code) return null;
    const flags = await getClanFlags([c.clanId]);
    return { game: game.code, ...apiClan(c, flags.get(Number(c.clanId))), membersUrl: apiPath(`/rankings/${game.code}/clans/${c.clanId}/members`) };
  });
}
