import { env } from "./env";

// Days of the site ("today", award days, daily charts) in the time zone of
// TZ, like the times shown; without TZ the server's zone, in the Docker image
// UTC. The collector writes hlstats_Players_History and the stored award days
// in its own TZ, so both should be set to the same zone.

let zoneCache: string | undefined;

export function siteZone(): string {
  if (zoneCache) return zoneCache;
  // An unknown name (or an empty TZ, which Node reports as "Etc/Unknown") falls
  // back to the server's zone, then to UTC.
  const valid = (tz: string | undefined) => {
    if (!tz) return undefined;
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: tz }).resolvedOptions().timeZone;
    } catch {
      return undefined;
    }
  };
  return (zoneCache = valid(env("TZ")?.replace(/^:/, "")) ?? valid(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? "UTC");
}

let partsFmt: Intl.DateTimeFormat | undefined;

// Wall clock of the site's zone at `ms` (Unix milliseconds).
function wallClock(ms: number) {
  partsFmt ??= new Intl.DateTimeFormat("en-US", {
    timeZone: siteZone(),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(partsFmt.formatToParts(ms).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), min: Number(p.minute), s: Number(p.second) };
}

// "YYYY-MM-DD" `days` calendar days after `day`.
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

// Day "YYYY-MM-DD" of the site's zone at Unix seconds `unix`.
export function dayOf(unix: number): string {
  const w = wallClock(unix * 1000);
  return `${w.y}-${String(w.m).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`;
}

// Today in the site's zone, or `offset` days from it.
export function siteDay(offset = 0): string {
  const today = dayOf(Math.floor(Date.now() / 1000));
  return offset ? addDays(today, offset) : today;
}

// How far the site's zone is ahead of UTC at `ms`, in milliseconds.
function zoneOffset(ms: number): number {
  const w = wallClock(ms);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s) - Math.floor(ms / 1000) * 1000;
}

// Unix seconds of 00:00 of `day` in the site's zone. Checked twice, because
// the offset can differ between the UTC guess and the real start (DST).
export function dayStart(day: string): number {
  const utc = Date.parse(`${day}T00:00:00Z`);
  const first = utc - zoneOffset(utc);
  return Math.floor((utc - zoneOffset(first)) / 1000);
}

// [start, end) of `day` in Unix seconds; 23 or 25 hours on DST days.
export function dayRange(day: string): [number, number] {
  return [dayStart(day), dayStart(addDays(day, 1))];
}
