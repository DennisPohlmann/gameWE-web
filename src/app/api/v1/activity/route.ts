import { api } from "@/lib/api";
import { activityDaysArg, activitySeries } from "@/lib/api-activity";
import { getHourlyActivity } from "@/lib/data";

// Players online, servers with players, kills and headshots per 15 minutes
// over all rankings: the general statistics' lines and the load chart of
// the start page.
export function GET(req: Request) {
  return api(async () => {
    const days = activityDaysArg(new URL(req.url).searchParams, 30);
    return { days, ...activitySeries(await getHourlyActivity(null, days)) };
  });
}
