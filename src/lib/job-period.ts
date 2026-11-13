// The period of the reset page's job list: ?from= and ?to= as YYYY-MM-DD in
// the web server's time zone (as the list prints its times), both days
// included; by default the last JOB_DAYS days up to today. Anything invalid
// (format, a date that does not exist, from after to, more than MAX_DAYS)
// gives the default and invalid: true.
export const JOB_DAYS = 14;
export const MAX_DAYS = 366;

export type JobPeriod = { from: string; to: string; start: number; end: number; invalid: boolean };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function day(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return iso(d) === v ? d : null; // 2026-02-30 rolls over and is refused
}

export function jobPeriod(from: string, to: string, now = new Date()): JobPeriod {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - n);
  const make = (f: Date, t: Date, invalid: boolean): JobPeriod => ({
    from: iso(f),
    to: iso(t),
    start: Math.floor(f.getTime() / 1000),
    end: Math.floor(back(t, -1).getTime() / 1000),
    invalid,
  });
  const fallback = (invalid: boolean) => make(back(today, JOB_DAYS - 1), today, invalid);
  if (!from && !to) return fallback(false);
  const t = to ? day(to) : today;
  const f = from ? day(from) : t && back(t, JOB_DAYS - 1);
  if (!f || !t || f > t || back(t, MAX_DAYS - 1) > f) return fallback(true);
  return make(f, t, false);
}
