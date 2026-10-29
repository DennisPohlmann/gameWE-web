import { api } from "@/lib/api";
import { publicClan, clanMembers } from "@/lib/api-clan";
import { intArg, kpd, share } from "@/lib/api-params";
import { everyDay, getMembersHistory } from "@/lib/data";

// The members' days added up (the clan page's summary and its 30-day
// lines), oldest first; days without play are 0.
export function GET(req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game, id } = await params;
    const found = await publicClan(game, id);
    if (!found) return null;
    const days = intArg(new URL(req.url).searchParams, "days", 30, 1, 90);
    const { ids } = await clanMembers(found.clan.clanId);
    const rows = await getMembersHistory(ids, days);
    return {
      game: found.game.code,
      id: found.clan.clanId,
      days,
      data: everyDay(rows.map((r) => ({ ...r, day: String(r.eventTime).slice(0, 10) })), days).map(({ day, point: h }) => ({
        day,
        connectionTime: h ? h.connection_time : 0,
        rounds: h ? h.rounds : 0,
        wins: h ? h.wins : 0,
        survived: h ? h.survived_count : 0,
        kills: h ? h.kills : 0,
        deaths: h ? h.deaths : 0,
        kpd: h ? kpd(h.kills, h.deaths) : 0,
        headshots: h ? h.headshots : 0,
        hpk: h ? share(h.headshots, h.kills) : null,
        assists: h ? h.kill_assists : 0,
        shots: h ? h.shots : 0,
        hits: h ? h.hits : 0,
        accuracy: h ? share(h.hits, h.shots) : null,
        pointsChange: h ? h.skill_change : 0,
      })),
    };
  });
}
