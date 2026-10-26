// The events page of a ranking (/<game>/events): the period it covers, the
// type filter, the groups of its chart over time and the share of each type.
// No imports, so the tests can load it directly.

// The kinds of a ranking's events, as in lib/history.ts (GAME_EVENT_KINDS).
export const PAGE_EVENT_KINDS = ["connect", "entry", "disconnect", "team", "role", "name", "action", "playeraction", "teambonus", "kill", "suicide", "teamkill"] as const;
export type PageEventKind = (typeof PAGE_EVENT_KINDS)[number];

// Period of the page: the last hour, 24 hours or 7 days, with the step of
// its chart (5 minutes, 1 hour, 1 hour). Longer periods are left out: the
// event tables have no index on the ranking, so the time keeps the reads
// short.
export const EVENT_PERIODS = {
  "1h": { seconds: 3_600, step: 300 },
  "24h": { seconds: 86_400, step: 3_600 },
  "7d": { seconds: 604_800, step: 3_600 },
} as const;
export type EventPeriod = keyof typeof EVENT_PERIODS;
export const DEFAULT_PERIOD: EventPeriod = "24h";

// The `period` of the address; anything else is the default.
export function periodParam(v: string | undefined): EventPeriod {
  return v !== undefined && Object.hasOwn(EVENT_PERIODS, v) ? (v as EventPeriod) : DEFAULT_PERIOD;
}

// First second and number of chart steps of a period ending at `now`: the
// start is rounded down to a whole step, so the steps sit on full hours or
// five minutes, and the last step is the current one.
export function periodRange(period: EventPeriod, now: number): { from: number; step: number; n: number } {
  const { seconds, step } = EVENT_PERIODS[period];
  const from = Math.floor((now - seconds) / step) * step;
  return { from, step, n: Math.floor((now - from) / step) + 1 };
}

// Types in the filter: actions on another player count as actions (both
// are called "Action"), so the filter has one entry for both.
export const FILTER_KINDS = PAGE_EVENT_KINDS.filter((k) => k !== "playeraction");
export type FilterKind = (typeof FILTER_KINDS)[number];

// The `type` of the address: one filter entry, or "" for all types.
export function typeParam(v: string | undefined): FilterKind | "" {
  return v !== undefined && (FILTER_KINDS as readonly string[]).includes(v) ? (v as FilterKind) : "";
}

// The kinds a filter entry stands for.
export function kindsOf(type: FilterKind | ""): PageEventKind[] {
  if (type === "") return [...PAGE_EVENT_KINDS];
  return type === "action" ? ["action", "playeraction"] : [type];
}

// Lines of the chart over time: few enough to tell apart, each a group of
// related kinds, in the order of the legend.
export const EVENT_GROUPS = [
  { id: "kills", kinds: ["kill"] },
  { id: "actions", kinds: ["action", "playeraction", "teambonus"] },
  { id: "joins", kinds: ["connect", "entry", "disconnect"] },
  { id: "changes", kinds: ["team", "role", "name"] },
  { id: "deaths", kinds: ["suicide", "teamkill"] },
] as const satisfies readonly { id: string; kinds: readonly PageEventKind[] }[];
export type EventGroup = (typeof EVENT_GROUPS)[number]["id"];

// Rows of the list at most: deeper pages would read ever more rows of
// every event table. Narrowing the type or the period shows the rest.
export const MAX_LIST_ROWS = 5_000;

// One count of the database: events of a kind in chart step `b` (0 is the
// first step of the period).
export type EventCount = { kind: string; b: number | string; n: number | string };

export type EventStats = {
  // Events of each filter entry over the whole period.
  byType: Record<FilterKind, number>;
  total: number;
  // Events of each group per chart step.
  series: Record<EventGroup, number[]>;
};

// Counts per kind and step → totals per filter entry and the lines of the
// chart. Unknown kinds and steps outside the period are left out.
export function eventStats(rows: EventCount[], n: number): EventStats {
  const byType = Object.fromEntries(FILTER_KINDS.map((k) => [k, 0])) as Record<FilterKind, number>;
  const series = Object.fromEntries(EVENT_GROUPS.map((g) => [g.id, new Array<number>(n).fill(0)])) as Record<EventGroup, number[]>;
  const groupOf = new Map<string, EventGroup>(EVENT_GROUPS.flatMap((g) => g.kinds.map((k) => [k, g.id] as const)));
  let total = 0;
  for (const r of rows) {
    const group = groupOf.get(r.kind);
    const b = Number(r.b);
    const c = Number(r.n);
    if (!group || !Number.isInteger(b) || b < 0 || b >= n || !(c > 0)) continue;
    const type = (r.kind === "playeraction" ? "action" : r.kind) as FilterKind;
    byType[type] += c;
    series[group][b] += c;
    total += c;
  }
  return { byType, total, series };
}

// The filter entries with events, most first (equal counts in the order of
// the filter), with their share of all events.
export function eventShares(stats: EventStats): { type: FilterKind; n: number; share: number }[] {
  return FILTER_KINDS.map((type, i) => ({ type, n: stats.byType[type], share: stats.total ? stats.byType[type] / stats.total : 0, i }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map(({ type, n, share }) => ({ type, n, share }));
}
