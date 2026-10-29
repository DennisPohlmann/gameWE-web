import { api, apiCountry, visibleGame } from "@/lib/api";
import { getMiscStats } from "@/lib/data";
import { dicts } from "@/translations";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

// The misc page of a ranking: countries of the ranked players, connects and
// play time per weekday (last year), connect methods (where the collector
// records them) and connects per day of the last 30 days.
export function GET(_req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const game = await visibleGame((await params).game);
    if (!game) return null;
    const m = await getMiscStats(game.code, 30);
    return {
      game: game.code,
      countries: m.countries.map((c) => ({ country: apiCountry(c.flag, c.country), players: c.n })),
      weekdays: m.weekdays.map((d, i) => ({ weekday: WEEKDAYS[i], connects: d.connects, connectionTime: d.seconds })),
      connectTypes: m.connectTypes.map((c) => ({ type: c.type, name: (dicts.en.connectTypes as Record<string, string>)[c.type] ?? null, connects: c.n })),
      connectsPerDay: m.connectsPerDay.map((d) => ({ day: d.day, connects: d.n })),
    };
  });
}
