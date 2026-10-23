import { api } from "@/lib/api";
import { getPlayer, getPlayerPosition } from "@/lib/data";
import { activity } from "@/lib/format";
import { getSettings } from "@/lib/settings";

// Public summary of one player; hidden players answer 404.
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { id } = await params;
    if (!/^\d{1,10}$/.test(id)) return null;
    const p = await getPlayer(Number(id));
    if (!p || p.hideranking) return null;
    const [rank, { activityDays }] = await Promise.all([getPlayerPosition(p.game, p.skill), getSettings()]);
    return {
      id: p.playerId,
      game: p.game,
      name: p.name,
      rank,
      country: p.flag ? { code: p.flag.trim().toUpperCase(), name: p.country } : null,
      clan: p.clan ? { id: p.clan, tag: p.clanTag, name: p.clanName } : null,
      skill: p.skill,
      kills: p.kills,
      deaths: p.deaths,
      suicides: p.suicides,
      headshots: p.headshots,
      teamKills: p.team_kills,
      killStreak: p.kill_streak,
      kpd: Math.round((p.kills / Math.max(1, p.deaths)) * 100) / 100,
      shots: p.shots,
      hits: p.hits,
      rounds: p.rounds,
      wins: p.wins,
      losses: p.losses,
      connectionTime: p.connection_time,
      firstConnect: p.first_connect,
      lastEvent: p.last_event,
      activity: activity(p.last_event, activityDays),
    };
  });
}
