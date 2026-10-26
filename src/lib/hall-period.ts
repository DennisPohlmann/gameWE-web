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
// Periods that do not start on the 1st or a Monday (a schedule with a start
// day, "month@15") are named by their dates: "15. Okt. – 14. Nov. 2026".
export function periodLabel(r: HallPeriod, locale: string, week: string, short = false): string {
  const from = utc(r.start);
  const last = utc(r.end); // the last day of the period
  const [y, m] = r.start.split("-").map(Number);
  const yy = short ? String(y).slice(2) : String(y);
  const d = Number(r.start.slice(8, 10));
  const range = (o: Intl.DateTimeFormatOptions) => {
    const f = new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" });
    return last > from ? f.formatRange(from, last) : f.format(from);
  };
  const days = () => range(short ? { day: "numeric", month: "numeric" } : { day: "numeric", month: "short", year: "numeric" });
  if ((r.unit === "month" && d !== 1) || (r.unit === "week" && from.getUTCDay() !== 1)) return days();
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
// optional number before it ("2 month", "3 days"), every at most 120, and
// optionally the day the periods start after "@": the day of the month
// 1-28 ("month@15"), the weekday 1-7 for weeks (Monday 1, "week@3"), the
// date MM-DD for years ("year@07-01"). Without it periods start on the
// 1st, on Monday and on 1 January.
export const MAX_EVERY = 120;
export type Schedule = { unit: HallUnit; every: number; day: number; month: number };

export function parseSchedule(v: string): Schedule | null {
  const m = /^(?:(\d{1,3})\s+)?(day|week|month|quarter|year)s?(?:\s*@\s*(\d{1,2})(?:-(\d{1,2}))?)?$/i.exec(v.trim());
  if (!m) return null;
  let n = m[1] ? Number(m[1]) : 1;
  let u = m[2].toLowerCase();
  if (u === "quarter") {
    u = "month";
    n *= 3;
  }
  if (n < 1 || n > MAX_EVERY) return null;
  const s: Schedule = { unit: u as HallUnit, every: n, day: 1, month: 1 };
  if (m[3] === undefined) return s;
  const a = Number(m[3]);
  const b = m[4] === undefined ? undefined : Number(m[4]);
  if (u === "week" && b === undefined && a >= 1 && a <= 7) return { ...s, day: a };
  if (u === "month" && b === undefined && a >= 1 && a <= 28) return { ...s, day: a };
  if (u === "year" && b !== undefined && a >= 1 && a <= 12 && b >= 1 && b <= 28) return { ...s, month: a, day: b };
  return null;
}

// The schedule as stored: "month", "2 week", "month@15", "year@07-01", ""
// for none (same text as the collector's ResetSchedule.String).
export function scheduleValue(s: Schedule | null): string {
  if (!s) return "";
  let v = s.every === 1 ? s.unit : `${s.every} ${s.unit}`;
  if (s.unit === "year" && (s.month !== 1 || s.day !== 1)) v += `@${String(s.month).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`;
  else if ((s.unit === "week" || s.unit === "month") && s.day !== 1) v += `@${s.day}`;
  return v;
}

// gamewe_reset_last_<game> as the collector writes it: "UNIX SCHEDULE"
// (collector 0.19: "UNIX"). The Unix time of the running period's start.
export function lastStart(v: string | null | undefined): number {
  return Number.parseInt((v ?? "").trim().split(/\s+/)[0] ?? "", 10) || 0;
}

// The first day (YYYY-MM-DD) of the period after the one that started at
// `since` (Unix time of the start in the collector's time zone, as the
// collector stores it in gamewe_reset_last_<game>). The web does not know
// that zone; noon UTC of the same instant falls on the local date for every
// zone from UTC-12 to UTC+12 and a reset time before noon.
export function nextStart(since: number, s: { unit: HallUnit; every: number }): string {
  const d = new Date((Math.floor((since * 1000 + 43_200_000) / 86_400_000) * 86_400_000));
  if (s.unit === "day") d.setUTCDate(d.getUTCDate() + s.every);
  else if (s.unit === "week") d.setUTCDate(d.getUTCDate() + 7 * s.every);
  else if (s.unit === "month") d.setUTCMonth(d.getUTCMonth() + s.every);
  else d.setUTCFullYear(d.getUTCFullYear() + s.every);
  return d.toISOString().slice(0, 10);
}

// The places of a period: its entries in stored order without the removed
// ones and those of hidden players, the first three numbered 1 to 3.
export function podium<T extends { stored: number; removed: boolean; hidden: boolean }>(entries: T[]): (T & { place: number })[] {
  return entries
    .filter((e) => !e.removed && !e.hidden)
    .sort((a, b) => a.stored - b.stored)
    .slice(0, 3)
    .map((e, i) => ({ ...e, place: i + 1 }));
}
