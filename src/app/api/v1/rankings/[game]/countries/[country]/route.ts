import { api, visibleGame } from "@/lib/api";
import { apiPlace } from "@/lib/api-places";
import { getPlaceRanking } from "@/lib/data";

// One country of a ranking: its totals and its place among the countries.
export function GET(_req: Request, { params }: { params: Promise<{ game: string; country: string }> }) {
  return api(async () => {
    const { game: code, country: raw } = await params;
    const game = await visibleGame(code);
    if (!game || !/^[A-Za-z]{2}$/.test(raw)) return null;
    const country = raw.toLowerCase();
    const [one, all] = await Promise.all([
      getPlaceRanking({ game: game.code, cities: false, country, sort: "players", asc: false, limit: 1, offset: 0 }),
      getPlaceRanking({ game: game.code, cities: false, country: "", sort: "players", asc: false, limit: 300, offset: 0 }),
    ]);
    const row = one.rows[0];
    if (!row) return null;
    const rank = all.rows.findIndex((x) => x.code === row.code) + 1;
    return { game: game.code, ...apiPlace(game.code, row, rank || null, false) };
  });
}
