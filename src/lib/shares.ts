// Shares of a table's totals and team win splits as gameME shows them: time,
// kills and deaths per team and role, weapon and action shares, map shares and
// the CT/T win ratio. No imports and no database access, so the tests can load
// it directly. Run the tests with `npm test`.

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

// Weapons page: kills % = weapon kills / all kills, headshots % = weapon
// headshots / all headshots, Hpk = weapon headshots / weapon kills; 0 when
// there is nothing to divide by.
export type WeaponInput = { kills: number; headshots: number };

export function weaponTotals(rows: WeaponInput[]): { kills: number; headshots: number } {
  return rows.reduce((s, w) => ({ kills: s.kills + Number(w.kills), headshots: s.headshots + Number(w.headshots) }), { kills: 0, headshots: 0 });
}

export function weaponShares(w: WeaponInput, total: { kills: number; headshots: number }) {
  return {
    killsPct: share(Number(w.kills), total.kills),
    headshotsPct: share(Number(w.headshots), total.headshots),
    hpk: share(Number(w.headshots), Number(w.kills)),
  };
}

// Actions page: skill bonus is the player reward, or the team reward for a
// team action; achieved % = count / all counts.
export type ActionInput = { id: number; code: string; description: string | null; reward_player: number; reward_team: number; count: number };

export const actionName = (a: ActionInput) => a.description?.trim() || a.code;
export const actionBonus = (a: ActionInput) => Number(a.reward_player) || Number(a.reward_team);

export function actionShares<T extends ActionInput>(rows: T[]): { total: number; pct: (a: T) => number } {
  const total = rows.reduce((s, a) => s + Number(a.count), 0);
  return { total, pct: (a) => share(Number(a.count), total) };
}

// Sort keys of the actions table; default most achieved first.
export const ACTION_SORTS = ["name", "bonus", "count"] as const;
export type ActionSort = (typeof ACTION_SORTS)[number];

export function actionSort(v: string): ActionSort {
  return (ACTION_SORTS as readonly string[]).includes(v) ? (v as ActionSort) : "count";
}

export function sortActions<T extends ActionInput>(rows: T[], sort: ActionSort, flipped: boolean): T[] {
  const asc = flipped !== (sort === "name");
  const key = (a: T): number | string => (sort === "name" ? actionName(a).toLowerCase() : sort === "bonus" ? actionBonus(a) : Number(a.count));
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const c = typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y);
    return (asc ? c : -c) || Number(a.id) - Number(b.id);
  });
}

// A share 0..1 as bar text: one decimal, "<0.1%" for a tiny share that is
// not zero (a map with 0.04 % of all kills still had kills), "0%" for none.
export function shareText(share: number | null | undefined, locale: string): string {
  const s = share !== null && share !== undefined && Number.isFinite(share) ? share : 0;
  if (s <= 0) return "0%";
  const fmt = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (s < 0.0005) return `<${fmt(0.1)}%`;
  return `${fmt(s * 100)}%`;
}

// Bar fill for a share relative to the largest share of the list, so the
// top entry fills its bar and the others compare to it; the label keeps the
// real share. 0 without a largest share.
export function relativeFill(share: number | null | undefined, max: number): number {
  if (share === null || share === undefined || !Number.isFinite(share) || !(max > 0)) return 0;
  return Math.max(0, Math.min(1, share / max));
}

// CT and T round wins as whole percentages that add up to 100. A side with
// at least one win never shows 0 % (nor the other 100 %). null without any
// win: there is no ratio to show, not 50/50.
export function winSplit(ct: number, t: number): { ct: number; t: number } | null {
  const a = Math.max(0, Number(ct) || 0);
  const b = Math.max(0, Number(t) || 0);
  if (a + b === 0) return null;
  let pct = Math.round((a * 100) / (a + b));
  if (a > 0 && pct === 0) pct = 1;
  if (b > 0 && pct === 100) pct = 99;
  return { ct: pct, t: 100 - pct };
}

// The split the win bar draws: without any win both sides get half
// (data false, the tooltip says so) instead of an empty bar.
export function winBarSplit(ct: number, t: number): { ct: number; t: number; data: boolean } {
  const s = winSplit(ct, t);
  return s ? { ...s, data: true } : { ct: 50, t: 50, data: false };
}

// Round wins per map and side from rows (map id, team code of the winning
// action, wins). Team codes as in hlstats_Actions.team: "CT" and
// "TERRORIST"; anything else (games without sides) is left out.
export function winsByMap(rows: { map: number | string; team: string | null; wins: number | string }[]): Map<number, { ct: number; t: number }> {
  const out = new Map<number, { ct: number; t: number }>();
  for (const r of rows) {
    const team = (r.team ?? "").trim().toUpperCase();
    if (team !== "CT" && team !== "TERRORIST") continue;
    const id = Number(r.map);
    const w = out.get(id) ?? { ct: 0, t: 0 };
    if (team === "CT") w.ct += Number(r.wins) || 0;
    else w.t += Number(r.wins) || 0;
    out.set(id, w);
  }
  return out;
}
