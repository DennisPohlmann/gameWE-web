import { api, visibleGame } from "@/lib/api";
import { kpd, share } from "@/lib/api-params";
import { getRoles, getTeams, type TeamRow } from "@/lib/data";
import { shareTotals, sortTeams, type ShareTotals } from "@/lib/shares";

const row = (t: TeamRow, total: ShareTotals, i: number) => ({
  position: i + 1,
  id: Number(t.id),
  code: t.code,
  name: t.name,
  timePlayed: Number(t.time_played),
  timeShare: share(t.time_played, total.time),
  kills: Number(t.kills),
  killShare: share(t.kills, total.kills),
  deaths: Number(t.deaths),
  deathShare: share(t.deaths, total.deaths),
  headshots: Number(t.headshots),
  kpd: kpd(t.kills, t.deaths),
  wins: Number(t.wins),
  losses: Number(t.losses),
  rounds: Number(t.rounds),
});

// Rows without any time, kill or death (e.g. a team code seen once) are left
// out, as on the website; the shares are of the table's total.
const used = (r: TeamRow) => Number(r.time_played) > 0 || Number(r.kills) > 0 || Number(r.deaths) > 0;
const table = (rows: TeamRow[]) => {
  const shown = rows.filter(used);
  const total = shareTotals(shown);
  return sortTeams(shown, "time", false).map((t, i) => ({ ...row(t, total, i), joined: Number(t.joined) }));
};

// The teams (with how often players joined them) and roles of a ranking, as
// the website's teams page: most time first, time, kills and deaths with
// their share of the table.
export function GET(_req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const [teams, roles] = await Promise.all([getTeams(game.code), getRoles(game.code)]);
    return {
      game: game.code,
      teams: table(teams),
      roles: table(roles).map(({ joined: _joined, ...r }) => r),
    };
  });
}
