import { api, visibleGame } from "@/lib/api";
import { kpd } from "@/lib/api-params";
import { getRoles, getTeams, type TeamRow } from "@/lib/data";

const row = (t: TeamRow) => ({
  id: Number(t.id),
  code: t.code,
  name: t.name,
  timePlayed: Number(t.time_played),
  kills: Number(t.kills),
  deaths: Number(t.deaths),
  headshots: Number(t.headshots),
  kpd: kpd(t.kills, t.deaths),
  wins: Number(t.wins),
  losses: Number(t.losses),
  rounds: Number(t.rounds),
});

// The teams (with how often players joined them) and roles of a ranking.
export function GET(_req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const [teams, roles] = await Promise.all([getTeams(game.code), getRoles(game.code)]);
    return {
      game: game.code,
      teams: teams.map((t) => ({ ...row(t), joined: Number(t.joined) })),
      roles: roles.map(row),
    };
  });
}
