import { api, apiMap, apiPath, visibleGame } from "@/lib/api";
import { pathId } from "@/lib/api-params";
import { countMapKillers, getMap, getMapAccuracy, getMapLoadTime, getMapWins } from "@/lib/data";
import { kpm, mapPlayTime } from "@/lib/map-table";
import { SIDE_GAMES } from "@/lib/shares";

// One map of a ranking with the details of the website's map page: play
// time (stored or from the server load), CT/T wins, kills per minute,
// accuracy (null without per-map shot stats) and the kills of hidden players.
export function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game: code, id } = await params;
    const game = await visibleGame(code);
    const mapId = pathId(id);
    if (!game || !mapId) return null;
    const m = await getMap(mapId);
    if (!m || m.game !== game.code) return null;
    const [wins, accuracy, loadTime, counts] = await Promise.all([
      getMapWins(game.code).catch(() => new Map<number, { ct: number; t: number }>()),
      getMapAccuracy(m.id).catch(() => null),
      getMapLoadTime(m.id).catch(() => 0),
      countMapKillers(m.id),
    ]);
    const time = mapPlayTime(m.play_time, loadTime);
    const sided = wins.size > 0 || SIDE_GAMES.has(game.realgame ?? "");
    const perMin = kpm(Number(m.kills), time);
    return {
      game: game.code,
      ...apiMap(m, sided ? (wins.get(Number(m.id)) ?? { ct: 0, t: 0 }) : undefined),
      playTime: time,
      killsPerMinute: perMin === null ? null : Math.round(perMin * 100) / 100,
      accuracy: accuracy === null ? null : Math.round(accuracy * 10000) / 10000,
      players: counts.players,
      hiddenKills: counts.hiddenKills,
      playersUrl: apiPath(`/rankings/${game.code}/maps/${m.id}/players`),
    };
  });
}
