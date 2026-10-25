// Sorting of tables by a click on a column head (SortTh in ui.tsx): the
// sort key and direction come from the URL (?sort=kills&dir=asc, or the
// table's own param names when a page has more than one sortable table).
// The key is always looked up in the table's allowlist, so it can be used
// in ORDER BY (SQL sort maps such as rankingSorts) or to sort loaded rows
// (value maps for sortRows); an unknown key falls back to the default.

type Raw = string | string[] | undefined;

export type SortState<K extends string> = {
  sort: K;
  asc: boolean;
  // The params to keep in links (pager, filters): empty for the default.
  keep: Record<string, string | undefined>;
};

function first(v: Raw): string {
  return (Array.isArray(v) ? v[0] : (v ?? "")).trim().slice(0, 64);
}

// A key of the allowlist, never an inherited one ("toString", "__proto__").
export function isSortKey<K extends string>(sorts: Record<K, unknown>, key: string): key is K {
  return Object.hasOwn(sorts, key);
}

export function sortState<S extends Record<string, unknown>>(
  sp: Record<string, Raw>,
  sorts: S,
  fallback: keyof S & string,
  opts: { sortParam?: string; dirParam?: string; asc?: boolean } = {},
): SortState<keyof S & string> {
  const sortName = opts.sortParam ?? "sort";
  const dirName = opts.dirParam ?? "dir";
  const raw = first(sp[sortName]);
  // Without a sort param the table keeps its default order, which can be
  // ascending (a list of names). With one, the direction is the dir param
  // (SortTh: a first click sorts descending, the second ascending).
  if (!isSortKey(sorts, raw)) return { sort: fallback, asc: !!opts.asc, keep: {} };
  const asc = first(sp[dirName]) === "asc";
  return { sort: raw, asc, keep: { [sortName]: raw, [dirName]: asc ? "asc" : undefined } };
}

// Players of one rank (awards page), most kills first.
export const rankPlayerSorts = {
  kills: "p.kills",
  name: "d.lastName",
  skill: "p.skill",
  time: "p.connection_time",
  activity: "p.last_event",
} as const;
export type RankPlayerSort = keyof typeof rankPlayerSorts;

// Daily awards a player won, newest first.
export const awardWinSorts = {
  date: "h.date",
  award: "a.name",
} as const;
export type AwardWinSort = keyof typeof awardWinSorts;

// Stored player addresses (admin), newest connect first. The keys are the
// aliases of the grouped query (searchIps).
export const ipSorts = {
  last: "last",
  first: "first",
  connects: "connects",
  ip: "ip",
  name: "name",
  steam: "uniqueId",
  game: "game",
  host: "hostname",
} as const;
export type IpSort = keyof typeof ipSorts;

// An address as a text that sorts in address order (IPv4 octets padded).
export function ipSortKey(ip: string): string | null {
  if (!ip || ip === "-") return null;
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip.split(".").map((o) => o.padStart(3, "0")).join(".") : ip.toLowerCase();
}

// Chat and event logs sort only by their time: they can hold millions of
// rows, and that is the column with an index.
export const timeSorts = { date: true } as const;

export type SortValue = number | string | null | undefined;

// Sorts loaded rows by a value of the allowlist, a copy, stable (equal
// values keep the server's order), empty values last in both directions.
export function sortRows<T, K extends string>(rows: readonly T[], values: Record<K, (r: T) => SortValue>, sort: K, asc: boolean): T[] {
  const value = values[sort];
  return rows
    .map((r, i) => {
      const v = value(r);
      return { r, i, v: typeof v === "number" && Number.isNaN(v) ? null : v };
    })
    .sort((a, b) => {
      const x = a.v === "" ? null : a.v;
      const y = b.v === "" ? null : b.v;
      if (x === null || x === undefined || y === null || y === undefined) {
        const d = Number(x === null || x === undefined) - Number(y === null || y === undefined);
        return d || a.i - b.i;
      }
      const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true });
      return (asc ? d : -d) || a.i - b.i;
    })
    .map((e) => e.r);
}
