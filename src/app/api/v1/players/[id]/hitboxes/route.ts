import { api, publicPlayer } from "@/lib/api";
import { pathId, share } from "@/lib/api-params";
import { getPlayerWeapons } from "@/lib/data";
import { ZONES } from "@/lib/zones";

// Where a player hits: hits per body zone over all weapons (per weapon: /players/{id}/weapons).
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const weapons = await getPlayerWeapons(p.playerId);
    const hits = Object.fromEntries(ZONES.map((z) => [z, weapons.reduce((n, w) => n + Number(w[z]), 0)])) as Record<(typeof ZONES)[number], number>;
    const total = ZONES.reduce((n, z) => n + hits[z], 0);
    return {
      id: p.playerId,
      total,
      data: ZONES.map((z) => ({ zone: z, hits: hits[z], share: share(hits[z], total) })),
    };
  });
}
