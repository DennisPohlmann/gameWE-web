// A player's sessions table (one row per day in hlstats_Players_History):
// the sort keys of its column heads and the value each one sorts by, the
// page of the sorted rows and the time column. The rows are sorted here,
// not in SQL, because the points change of a day needs the day before it.

export type SessionRow = {
  eventTime: string;
  skill: number;
  points_change: number;
  connection_time: number;
  rounds: number;
  wins: number;
  kills: number;
  deaths: number;
  kill_streak: number;
  headshots: number;
  shots: number;
  hits: number;
};

// Kills per death; with no deaths the kills themselves, like gameME.
const kpd = (r: SessionRow) => (Number(r.deaths) > 0 ? Number(r.kills) / Number(r.deaths) : Number(r.kills));

// Without kills or shots there is no ratio: such days sort below 0 %.
const share = (a: number, b: number) => (Number(b) > 0 ? Number(a) / Number(b) : -1);

export const sessionSorts = {
  date: (r: SessionRow) => String(r.eventTime).slice(0, 10),
  change: (r: SessionRow) => Number(r.points_change),
  points: (r: SessionRow) => Number(r.skill),
  time: (r: SessionRow) => Number(r.connection_time),
  rounds: (r: SessionRow) => Number(r.rounds),
  wins: (r: SessionRow) => Number(r.wins),
  kills: (r: SessionRow) => Number(r.kills),
  deaths: (r: SessionRow) => Number(r.deaths),
  kpd,
  streak: (r: SessionRow) => Number(r.kill_streak),
  hs: (r: SessionRow) => Number(r.headshots),
  hpk: (r: SessionRow) => share(r.headshots, r.kills),
  acc: (r: SessionRow) => share(r.hits, r.shots),
} as const;
export type SessionSort = keyof typeof sessionSorts;

// Newest day first, as gameME opens the page.
export const SESSION_SORT_DEFAULT: SessionSort = "date";

// The sort key from the query string; own keys only, anything else (also
// "constructor" or "__proto__") is the default.
export function sessionSortParam(raw: string): SessionSort {
  return Object.hasOwn(sessionSorts, raw) ? (raw as SessionSort) : SESSION_SORT_DEFAULT;
}

// Highest (or newest) first; asc turns it round. Equal values keep the
// newest day on top.
export function sortSessions<R extends SessionRow>(rows: R[], sort: SessionSort, asc: boolean): R[] {
  const key = sessionSorts[sort];
  const day = sessionSorts.date;
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const c = typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y);
    return (asc ? c : -c) || day(b).localeCompare(day(a));
  });
}

// The page shown and the rows on it; a page past the end shows the last.
export function sessionPage<R>(rows: R[], page: number, limit: number): { page: number; pages: number; rows: R[] } {
  const pages = Math.max(1, Math.ceil(rows.length / limit));
  const p = Math.min(Math.max(1, Math.floor(page)), pages);
  return { page: p, pages, rows: rows.slice((p - 1) * limit, p * limit) };
}

// Seconds -> "0d 01:51h", the days always shown, like gameME's table.
export function fmtSessionTime(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}h`;
}
