// Shares of a table's totals as gameME shows them on the teams/roles page:
// time, kills and deaths of a row against the sum of its table. No imports,
// so the tests can load it directly. Run the tests with `npm test`.

export type ShareInput = { time_played: number; kills: number; deaths: number };

export type Shares = {
  // Row value / table total, 0..1; 0 when the table has no total.
  timePct: number;
  killsPct: number;
  deathsPct: number;
  // Kills per death; with no deaths the kills themselves, like gameME.
  kpd: number;
  // False for a team without a kill or death (spectators, unassigned):
  // the page shows "-" instead of 0 for its kills and deaths.
  fought: boolean;
};

export type ShareTotals = { time: number; kills: number; deaths: number };

const share = (part: number, total: number) => (total > 0 && Number.isFinite(part) ? part / total : 0);

export function shareTotals(rows: ShareInput[]): ShareTotals {
  return rows.reduce(
    (s, r) => ({ time: s.time + Number(r.time_played), kills: s.kills + Number(r.kills), deaths: s.deaths + Number(r.deaths) }),
    { time: 0, kills: 0, deaths: 0 },
  );
}

export function rowShares(r: ShareInput, total: ShareTotals): Shares {
  const kills = Number(r.kills);
  const deaths = Number(r.deaths);
  return {
    timePct: share(Number(r.time_played), total.time),
    killsPct: share(kills, total.kills),
    deathsPct: share(deaths, total.deaths),
    kpd: deaths > 0 ? kills / deaths : kills,
    fought: kills > 0 || deaths > 0,
  };
}

// Sort keys of the teams/roles tables; default most time first.
export const TEAM_SORTS = ["name", "time", "kills", "deaths", "kpd"] as const;
export type TeamSort = (typeof TEAM_SORTS)[number];

export function teamSort(v: string): TeamSort {
  return (TEAM_SORTS as readonly string[]).includes(v) ? (v as TeamSort) : "time";
}

// Names read best A to Z, numbers biggest first; flipped turns it round
// (?dir=asc on the page). Ties keep the id order.
export function sortTeams<T extends ShareInput & { id: number; name: string }>(rows: T[], sort: TeamSort, flipped: boolean): T[] {
  const asc = flipped !== (sort === "name");
  const key = (r: T): number | string => {
    switch (sort) {
      case "name":
        return r.name.toLowerCase();
      case "time":
        return Number(r.time_played);
      case "kills":
        return Number(r.kills);
      case "deaths":
        return Number(r.deaths);
      case "kpd":
        return Number(r.deaths) > 0 ? Number(r.kills) / Number(r.deaths) : Number(r.kills);
    }
  };
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const c = typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y);
    return (asc ? c : -c) || Number(a.id) - Number(b.id);
  });
}
