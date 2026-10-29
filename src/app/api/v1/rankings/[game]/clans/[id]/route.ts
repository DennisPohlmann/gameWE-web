import { api, apiClan, apiCountry, apiPath, visibleGame } from "@/lib/api";
import { clanMembers } from "@/lib/api-clan";
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
    const [flags, m] = await Promise.all([getClanFlags([c.clanId]), clanMembers(c.clanId)]);
    // Where the members come from (active and inactive): each country with
    // its number of members, most first, as on the clan page.
    const origins = new Map<string, { country: ReturnType<typeof apiCountry>; members: number }>();
    for (const r of [...m.members, ...m.gone]) {
      const country = apiCountry(r.flag, r.country);
      if (!country) continue;
      const o = origins.get(country.code) ?? { country, members: 0 };
      o.members++;
      origins.set(country.code, o);
    }
    const base = `/rankings/${game.code}/clans/${c.clanId}`;
    return {
      game: game.code,
      ...apiClan(c, flags.get(Number(c.clanId))),
      inactive: m.inactive,
      inactiveMembers: m.gone.length,
      origins: [...origins.values()].sort((a, b) => b.members - a.members || a.country!.code.localeCompare(b.country!.code)),
      membersUrl: apiPath(`${base}/members`),
      links: Object.fromEntries(["history", "radar", "weapons", "maps", "map", "events"].map((k) => [k, apiPath(`${base}/${k}`)])),
    };
  });
}
