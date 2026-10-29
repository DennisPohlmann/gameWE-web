import { api, apiBan, apiPath, publicPlayer } from "@/lib/api";
import { kpd, pathId, share } from "@/lib/api-params";
import { getRanks, rankFor } from "@/lib/awards";
import { getPlayerPosition, getPlayerWeapons } from "@/lib/data";
import { activity } from "@/lib/format";
import { kpm } from "@/lib/map-table";
import { getSettings } from "@/lib/settings";
import { getPlayerStars, hallOfFameShown } from "@/lib/hall-of-fame";
import { playerBans } from "@/lib/bans";
import { dicts } from "@/translations";

const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

// Public summary of one player with the values of the website's profile
// (player profile and summary); hidden players, bots without a profile and
// players of hidden rankings answer 404. No Steam ID, Steam profile or IP.
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { id } = await params;
    const p = await publicPlayer(pathId(id));
    if (!p) return null;
    const [rank, { activityDays }, weapons, ranks, hall] = await Promise.all([
      // As on the profile: a player banned in the ranking has no place.
      Number(p.hideranking) ? Promise.resolve(null) : getPlayerPosition(p.game, p.skill),
      getSettings(),
      getPlayerWeapons(p.playerId),
      getRanks(p.game),
      hallOfFameShown(p.game),
    ]);
    // The bans of the profile (texts in English); a player banned in the
    // ranking (hideranking 2) has no place in it.
    const bans = await playerBans(p, dicts.en.vacBanned, dicts.en);
    // Hall of fame stars, as on the profile; null where the ranking shows no hall of fame.
    const stars = hall ? await getPlayerStars(p.game, p.playerId) : null;
    const fav = weapons[0];
    const career = rankFor(Number(p.careerKills), ranks);
    return {
      id: p.playerId,
      game: p.game,
      name: p.name,
      rank: rank === null ? null : Number(rank),
      country: p.flag ? { code: p.flag.trim().toUpperCase(), name: p.country } : null,
      state: p.state || null,
      city: p.city || null,
      clan: p.clan ? { id: p.clan, tag: p.clanTag, name: p.clanName } : null,
      points: Number(p.skill),
      // Points change of the last event, as beside the points on the profile.
      pointsChange: Number(p.last_skill_change),
      // Deprecated name of points.
      skill: Number(p.skill),
      kills: p.kills,
      deaths: p.deaths,
      suicides: p.suicides,
      headshots: p.headshots,
      teamKills: p.team_kills,
      killStreak: p.kill_streak,
      kpd: kpd(p.kills, p.deaths),
      hpk: share(p.headshots, p.kills),
      killsPerMinute: round2(kpm(Number(p.kills), Number(p.connection_time))),
      assists: Number(p.kill_assists),
      assistedKills: Number(p.kills_assisted),
      shots: p.shots,
      hits: p.hits,
      accuracy: share(p.hits, p.shots),
      shotsPerKill: Number(p.kills) && Number(p.shots) ? round2(Number(p.shots) / Number(p.kills)) : null,
      rounds: p.rounds,
      wins: p.wins,
      losses: p.losses,
      winRatio: share(p.wins, p.rounds),
      survived: Number(p.survived_count),
      survivedShare: share(p.survived_count, p.rounds),
      connectionTime: p.connection_time,
      connects: p.total_connects === null ? null : Number(p.total_connects),
      averagePing: Number(p.average_ping) || null,
      firstConnect: p.first_connect,
      lastEvent: p.last_event,
      activity: activity(p.last_event, activityDays),
      careerRank: career ? { index: career.index, name: career.name, minKills: Number(career.minimum), nextAt: career.next === null ? null : Number(career.next) } : null,
      favoriteWeapon: fav ? { code: fav.code, name: fav.name?.trim() || fav.code, kills: Number(fav.kills) } : null,
      stars,
      banned: Number(p.hideranking) === 2 || bans.length > 0,
      bans: bans.map(apiBan),
      links: {
        weapons: apiPath(`/players/${p.playerId}/weapons`),
        hitboxes: apiPath(`/players/${p.playerId}/hitboxes`),
        maps: apiPath(`/players/${p.playerId}/maps`),
        teams: apiPath(`/players/${p.playerId}/teams`),
        actions: apiPath(`/players/${p.playerId}/actions`),
        opponents: apiPath(`/players/${p.playerId}/opponents`),
        killStats: apiPath(`/players/${p.playerId}/kills`),
        names: apiPath(`/players/${p.playerId}/names`),
        history: apiPath(`/players/${p.playerId}/history`),
        awards: apiPath(`/players/${p.playerId}/awards`),
        ribbons: apiPath(`/players/${p.playerId}/ribbons`),
        events: apiPath(`/players/${p.playerId}/events`),
        radar: apiPath(`/players/${p.playerId}/radar`),
        banner: apiPath(`/players/${p.playerId}/banner`),
      },
    };
  });
}
