// The period of the reset page's job list: ?from= and ?to= as YYYY-MM-DD in
// the web server's time zone (as the list prints its times), both days
// included, each optional. Without them the list has no time limit: it shows
// every job still stored (the collector deletes finished ones after a while).
// Anything invalid (format, a date that does not exist, from after to) gives
// no limit and invalid: true.
export type JobPeriod = { from: string; to: string; start?: number; end?: number; invalid: boolean };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function day(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return iso(d) === v ? d : null; // 2026-02-30 rolls over and is refused
}

export function jobPeriod(from: string, to: string): JobPeriod {
  const f = from ? day(from) : undefined;
  const t = to ? day(to) : undefined;
  if (f === null || t === null || (f && t && f > t)) return { from: "", to: "", invalid: true };
  return {
    from: from,
    to: to,
    start: f ? Math.floor(f.getTime() / 1000) : undefined,
    end: t ? Math.floor(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1).getTime() / 1000) : undefined,
    invalid: false,
  };
}
