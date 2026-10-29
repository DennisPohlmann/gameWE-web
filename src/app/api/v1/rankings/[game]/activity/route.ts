import { api, visibleGame } from "@/lib/api";
import { activityDaysArg, activitySeries } from "@/lib/api-activity";
import { getHourlyActivity } from "@/lib/data";

// Players online, servers with players, kills and headshots of a ranking
// per 15 minutes: the trend of the ranking's start page.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const game = await visibleGame((await params).game);
    if (!game) return null;
    const days = activityDaysArg(new URL(req.url).searchParams, 14);
    return { game: game.code, days, ...activitySeries(await getHourlyActivity(game.code, days)) };
  });
}
