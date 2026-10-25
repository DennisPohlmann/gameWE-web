// Points of a player per day for the "Player trend" chart: every calendar
// day from the first day with history to today, the points at the end of
// the day (the last known value on days without play) and the change
// against the day before, so a bar is always the step of the line.
//
// hlstats_Players_History.skill_change is the sum of the point deltas the
// collector recorded with that day's events. It does not always match the
// line (points changed without a history row, imported old rows), so the
// change is taken from the points themselves.

export type TrendRow = { day: string; skill: number; change: number };
export type TrendDay = { day: string; points: number; change: number; played: boolean };

const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

// rows: the history days in the range, oldest first. before: the points of
// the last history day before the range (null if there is none: then the
// first day's own change gives the points it started with).
export function pointsTrend(rows: TrendRow[], before: number | null, today: string): TrendDay[] {
  if (!rows.length) return [];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const last = rows[rows.length - 1].day > today ? rows[rows.length - 1].day : today;
  let prev = before ?? rows[0].skill - rows[0].change;
  const out: TrendDay[] = [];
  // At most a year, whatever the input.
  for (let day = rows[0].day; day <= last && out.length < 366; day = nextDay(day)) {
    const r = byDay.get(day);
    const points = r ? r.skill : prev;
    out.push({ day, points, change: points - prev, played: !!r });
    prev = points;
  }
  return out;
}
