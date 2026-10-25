import { api, apiPath, publicPlayer } from "@/lib/api";
import { kpd, pagingArg, paged, pathId } from "@/lib/api-params";
import { getPlayerSessions } from "@/lib/history";

// A player's days on the servers, newest first: points, kills and time per day.
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const pg = pagingArg(new URL(req.url).searchParams);
    const { rows, total } = await getPlayerSessions(p.playerId, pg.limit, pg.offset);
    return paged(
      rows.map((d) => ({
        day: String(d.eventTime).slice(0, 10),
        skill: Number(d.skill),
        skillChange: d.points_change,
        connectionTime: Number(d.connection_time),
        rounds: Number(d.rounds),
        wins: Number(d.wins),
        kills: Number(d.kills),
        deaths: Number(d.deaths),
        kpd: kpd(d.kills, d.deaths),
        headshots: Number(d.headshots),
        killStreak: Number(d.kill_streak),
        shots: Number(d.shots),
        hits: Number(d.hits),
      })),
      total,
      pg,
      apiPath(`/players/${p.playerId}/history`),
    );
  });
}
