import "server-only";
import { getGames } from "./data";
import { query } from "./db";
import { canFetchOverviews, mapsToDraw, requestOverview } from "./overview-fastdl";
import { forgetOverviewIndex, getOverview } from "./overviews";
import { fastdlRequestOf, getSettings } from "./settings";

// A game server changed to a map without a radar picture: draw it from FastDL
// (lib/overview-fastdl.ts) right away, not only when someone opens the map's
// page. The servers' current maps (hlstats_Servers.act_map, set by the
// collector) are looked at every 10 seconds: one small query.
const EVERY_MS = 10_000;

async function look() {
  // FastDL on but no folder to write to: the log says so once, at the start.
  if (!(await getSettings()).fastdlOn || !canFetchOverviews()) return;
  const [servers, games] = await Promise.all([
    query<{ game: string; map: string }>(`SELECT DISTINCT TRIM(game) AS game, act_map AS map FROM hlstats_Servers WHERE act_map <> ''`),
    getGames(),
  ]);
  for (const m of mapsToDraw(servers, new Map(games.map((g) => [g.code, g.realgame])))) {
    if (await getOverview(m.game, m.base, m.map).catch(() => null)) continue;
    const { base, headers } = await fastdlRequestOf(m.game).catch(() => ({ base: "", headers: {} }));
    requestOverview(base, m.base, m.map, forgetOverviewIndex, headers);
  }
}

export function watchServerMaps() {
  // The same error (e.g. no database) is logged once, not on every run; a
  // run still waiting on a stuck database is not joined by the next one.
  let last = "";
  let busy = false;
  const run = () => {
    if (busy) return;
    busy = true;
    look()
      .then(
        () => (last = ""),
        (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg !== last) console.warn("overview watch:", msg);
          last = msg;
        },
      )
      .finally(() => (busy = false));
  };
  setInterval(run, EVERY_MS).unref();
  run();
}
