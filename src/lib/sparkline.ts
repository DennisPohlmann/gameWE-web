// Background lines of the start page's "General statistics" cards: a series
// of values becomes an SVG path in a SPARK_W x SPARK_H box (stretched to the
// card, no axes, no text). No imports, so the tests can load it directly.

export const SPARK_W = 100;
export const SPARK_H = 30;

// One point of the drawn line: the values from..to (indexes into the series
// given to sparkBuckets), their sum and how many of them are numbers.
export type SparkBucket = { from: number; to: number; sum: number; n: number };

// The series from its first to its last value (nulls before are times before
// any data, after it times not recorded yet), cut into at most `max` buckets
// of consecutive values.
export function sparkBuckets(values: (number | null)[], max = 90): SparkBucket[] {
  const isNum = (v: number | null): v is number => v !== null && Number.isFinite(v);
  const first = values.findIndex(isNum);
  if (first < 0) return [];
  let last = values.length - 1;
  while (!isNum(values[last])) last--;
  const size = Math.max(1, Math.ceil((last - first + 1) / Math.max(1, max)));
  const out: SparkBucket[] = [];
  for (let from = first; from <= last; from += size) {
    const to = Math.min(from + size - 1, last);
    const nums = values.slice(from, to + 1).filter(isNum);
    out.push({ from, to, sum: nums.reduce((a, b) => a + b, 0), n: nums.length });
  }
  return out;
}

// The hover strips of the buckets with values: x is the point on the line,
// from..from+width the part of the box closest to it, so together they cover
// the whole width, also over gaps in the series.
export function sparkHits(buckets: SparkBucket[]): { bucket: SparkBucket; x: number; from: number; width: number }[] {
  const step = SPARK_W / Math.max(1, buckets.length - 1);
  const pts = buckets.flatMap((bucket, i) => (bucket.n ? [{ bucket, x: i * step }] : []));
  return pts.map(({ bucket, x }, i) => {
    const from = i ? (pts[i - 1].x + x) / 2 : 0;
    const to = i < pts.length - 1 ? (x + pts[i + 1].x) / 2 : SPARK_W;
    return { bucket, x, from, width: to - from };
  });
}

// The buckets' values: the mean of their numbers, or null when they have none.
export function sparkSeries(values: (number | null)[], max = 90): (number | null)[] {
  return sparkBuckets(values, max).map((b) => (b.n ? b.sum / b.n : null));
}

// The line (`line`) and the closed area below it (`area`) of a series, from
// its lowest value near the bottom (0 at the bottom when it reaches 0) to its
// highest value near the top: a series that never drops to 0 (players online
// with bots that stay on the servers) would otherwise be a flat line at the
// top; one that does not change at all lies in the middle. A gap (null)
// inside the series is bridged by a straight line to the next value, so the
// line never stops in the middle. null when fewer than two points have values.
export function sparkPaths(series: (number | null)[]): { line: string; area: string } | null {
  if (series.filter((v) => v !== null).length < 2) return null;
  const nums = series.filter((v): v is number => v !== null).map((v) => Math.max(0, v));
  const top = Math.max(...nums);
  const low = Math.min(...nums);
  const step = SPARK_W / (series.length - 1);
  const pad = 2;
  const floor = 3;
  const y = (v: number) =>
    low > 0
      ? top > low
        ? SPARK_H - floor - ((v - low) / (top - low)) * (SPARK_H - pad - floor)
        : SPARK_H / 2
      : top > 0
        ? SPARK_H - (v / top) * (SPARK_H - pad)
        : SPARK_H - 0.5;
  const r = (n: number) => String(Math.round(n * 100) / 100);
  const pts = series.flatMap((v, i): [number, number][] => (v === null ? [] : [[i * step, y(Math.max(0, v))]]));
  const line = pts.map(([x, py], i) => `${i ? "L" : "M"}${r(x)} ${r(py)}`).join("");
  const area = `M${r(pts[0][0])} ${SPARK_H}${pts.map(([x, py]) => `L${r(x)} ${r(py)}`).join("")}L${r(pts[pts.length - 1][0])} ${SPARK_H}Z`;
  return { line, area };
}

// A count per interval that starts at 0 where nothing was recorded yet (kills
// per 15 minutes before the first frag, e.g. after a reset): the zeros before
// the first value become gaps, so the line starts there and is not a long
// flat stretch at the bottom. The last interval is still running and would
// end the line low: it is left out.
export function countsSinceFirst(values: number[]): (number | null)[] {
  const done = values.slice(0, -1);
  const first = done.findIndex((v) => v !== 0);
  return first < 0 ? [] : done.map((v, i) => (i < first ? null : v));
}

// Values per day, today last: whole days only (today is not over yet and
// would end the line low), unless that leaves fewer than two days with a
// value, e.g. the day after a reset; then today is kept so the card still
// gets its line.
export function wholeDays(values: (number | null)[]): (number | null)[] {
  const whole = values.slice(0, -1);
  return whole.filter((v) => v !== null).length >= 2 ? whole : values;
}
