// Periods of the scheduled ranking resets (hall of fame): the schedule as
// stored in hlstats_Options and the names of the periods. No database access,
// so the admin pages can use it too.

// A stored period: unit and every N of it (a quarter is 3 months), its first
// and its last day (YYYY-MM-DD).
export type HallUnit = "day" | "week" | "month" | "year";
export type HallPeriod = { unit: HallUnit; every: number; start: string; end: string };

// Name of a period in the visitor's language, from its unit and length:
// "September 2026", "Sept.–Okt. 2026", "Q3 2026", "KW 43 2026",
// "26. Oktober 2026", "2026", "2026–2027". short: for chart axes ("Sept. 26").
// week: the word for a calendar week with {n} ("KW {n}", "Week {n}").
export function periodLabel(r: HallPeriod, locale: string, week: string, short = false): string {
  const from = utc(r.start);
  const last = utc(r.end); // the last day of the period
  const [y, m] = r.start.split("-").map(Number);
  const yy = short ? String(y).slice(2) : String(y);
  const range = (o: Intl.DateTimeFormatOptions) => {
    const f = new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" });
    return last > from ? f.formatRange(from, last) : f.format(from);
  };
  switch (r.unit) {
    case "year":
      return range({ year: "numeric" });
    case "month":
      if (r.every === 3 && (m - 1) % 3 === 0) return `Q${(m - 1) / 3 + 1} ${yy}`;
      return range({ month: short || r.every > 1 ? "short" : "long", year: short ? "2-digit" : "numeric" });
    case "week": {
      const [wy, w] = isoWeek(from);
      const [, wl] = isoWeek(last);
      const n = r.every > 1 ? `${w}–${wl}` : String(w);
      return `${week.replace("{n}", n)} ${short ? String(wy).slice(2) : wy}`;
    }
    default:
      return range(short ? { day: "numeric", month: "numeric" } : { day: "numeric", month: "long", year: "numeric" });
  }
}

function utc(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

// ISO 8601 week (weeks start on Monday, week 1 holds the first Thursday).
function isoWeek(d: Date): [number, number] {
  const t = new Date(d);
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));
  const y = t.getUTCFullYear();
  // t is the Thursday of d's week; its year is the week's year.
  return [y, Math.floor((t.getTime() - Date.UTC(y, 0, 1)) / 604_800_000) + 1];
}

// A reset schedule as the collector reads it (ParseResetSchedule):
// "", "off" = none; "day", "week", "month", "quarter", "year" with an
// optional number before it ("2 month", "3 days"), every at most 120.
export const MAX_EVERY = 120;
export function parseSchedule(v: string): { unit: HallUnit; every: number } | null {
  const m = /^(?:(\d{1,3})\s+)?(day|week|month|quarter|year)s?$/i.exec(v.trim());
  if (!m) return null;
  let n = m[1] ? Number(m[1]) : 1;
  let u = m[2].toLowerCase();
  if (u === "quarter") {
    u = "month";
    n *= 3;
  }
  return n >= 1 && n <= MAX_EVERY ? { unit: u as HallUnit, every: n } : null;
}

// The schedule as stored: "month", "2 week", "" for none.
export function scheduleValue(s: { unit: HallUnit; every: number } | null): string {
  return s ? (s.every === 1 ? s.unit : `${s.every} ${s.unit}`) : "";
}

// The first day (YYYY-MM-DD) of the period after the one that started at
// `since` (Unix time of local midnight in the collector's time zone, as the
// collector stores it in gamewe_reset_last_<game>). The web does not know
// that zone; noon UTC of the same instant falls on the local date for every
// zone from UTC-12 to UTC+12.
export function nextStart(since: number, s: { unit: HallUnit; every: number }): string {
  const d = new Date((Math.floor((since * 1000 + 43_200_000) / 86_400_000) * 86_400_000));
  if (s.unit === "day") d.setUTCDate(d.getUTCDate() + s.every);
  else if (s.unit === "week") d.setUTCDate(d.getUTCDate() + 7 * s.every);
  else if (s.unit === "month") d.setUTCMonth(d.getUTCMonth() + s.every);
  else d.setUTCFullYear(d.getUTCFullYear() + s.every);
  return d.toISOString().slice(0, 10);
}
