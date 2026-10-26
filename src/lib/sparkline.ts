// Background lines of the start page's "General statistics" cards: a series
// of values becomes an SVG path in a SPARK_W x SPARK_H box (stretched to the
// card, no axes, no text). No imports, so the tests can load it directly.

export const SPARK_W = 100;
export const SPARK_H = 30;

// The series from its first to its last value (nulls before are times before
// any data, after it times not recorded yet), cut into at most `max` buckets
// of consecutive values; a bucket holds the mean of its numbers, or null when
// it has none.
export function sparkSeries(values: (number | null)[], max = 90): (number | null)[] {
  const first = values.findIndex((v) => v !== null && Number.isFinite(v));
  if (first < 0) return [];
  let last = values.length - 1;
  while (values[last] === null || !Number.isFinite(values[last])) last--;
  const rest = values.slice(first, last + 1);
  const size = Math.max(1, Math.ceil(rest.length / Math.max(1, max)));
  const out: (number | null)[] = [];
  for (let i = 0; i < rest.length; i += size) {
    const nums = rest.slice(i, i + size).filter((v): v is number => v !== null && Number.isFinite(v));
    out.push(nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
  }
  return out;
}

// The line (`line`) and the closed area below it (`area`) of a series, from
// 0 at the bottom to its highest value near the top; a gap (null) inside the
// series is bridged by a straight line to the next value, so the line never
// stops in the middle. null when fewer than two points have values.
export function sparkPaths(series: (number | null)[]): { line: string; area: string } | null {
  if (series.filter((v) => v !== null).length < 2) return null;
  const top = Math.max(...series.map((v) => v ?? 0));
  const step = SPARK_W / (series.length - 1);
  const pad = 2;
  const y = (v: number) => (top > 0 ? SPARK_H - (v / top) * (SPARK_H - pad) : SPARK_H - 0.5);
  const r = (n: number) => String(Math.round(n * 100) / 100);
  const pts = series.flatMap((v, i): [number, number][] => (v === null ? [] : [[i * step, y(Math.max(0, v))]]));
  const line = pts.map(([x, py], i) => `${i ? "L" : "M"}${r(x)} ${r(py)}`).join("");
  const area = `M${r(pts[0][0])} ${SPARK_H}${pts.map(([x, py]) => `L${r(x)} ${r(py)}`).join("")}L${r(pts[pts.length - 1][0])} ${SPARK_H}Z`;
  return { line, area };
}
