import { LANGUAGES, langDir, type Lang } from "../translations/languages";

const locales = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.locale])) as Record<Lang, string>;

// toLocaleString builds a new formatter on every call, which costs about
// 0.3 ms; the charts format thousands of times per page. These keep one
// formatter per locale and options.
type DateFormat = { format(d: number | Date): string };
const formatters = new Map<string, DateFormat | Intl.NumberFormat>();

// Right-to-left pages (Arabic): the locale puts right-to-left marks between
// the parts of a date, so the page showed "2026/11/13" with the time before
// the date. Dates read left to right instead, as one isolated run (U+2066 ...
// U+2069, which also works in title attributes and SVG text).
const rtlLocales = new Set<string>(LANGUAGES.filter((l) => langDir(l.code) === "rtl").map((l) => l.locale));
export function ltrDate(locale: string | undefined, s: string): string {
  return locale && rtlLocales.has(locale) ? `\u2066${s.replace(/[\u200e\u200f\u061c]/g, "")}\u2069` : s;
}

// Every date and time shown on the site goes through this (or fmtDate,
// fmtDateTime), so right-to-left pages get ltrDate.
export function dateFormat(locale: string, opts: Intl.DateTimeFormatOptions): DateFormat {
  const key = `d|${locale}|${JSON.stringify(opts)}`;
  let f = formatters.get(key) as DateFormat | undefined;
  if (!f) {
    const intl = new Intl.DateTimeFormat(locale, opts);
    formatters.set(key, (f = rtlLocales.has(locale) ? { format: (d) => ltrDate(locale, intl.format(d)) } : intl));
  }
  return f;
}

// Numbers only, no letters ("5,081 (27 %)", "827 / 829"): such a value reads
// left to right also on right-to-left pages (ltrNumbers in components/ui).
export function numbersOnly(v: unknown): v is string {
  return typeof v === "string" && /\d/.test(v) && !/\p{L}/u.test(v);
}

export function numberFormat(locale: string, opts: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `n|${locale}|${JSON.stringify(opts)}`;
  let f = formatters.get(key) as Intl.NumberFormat | undefined;
  if (!f) formatters.set(key, (f = new Intl.NumberFormat(locale, opts)));
  return f;
}

export function fmtNum(n: number | null | undefined, lang: Lang, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return numberFormat(locales[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function ratio(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

// Kills per death; with no deaths the kills themselves, like gameME.
export function kpd(kills: number, deaths: number): number {
  return deaths > 0 ? kills / deaths : kills;
}

// On right-to-left pages "27 %" stays in this order (else "% 27"), also
// inside translated sentences, title attributes and SVG text.
export function fmtPct(part: number | null | undefined, lang: Lang, digits = 0): string {
  if (part === null || part === undefined || !Number.isFinite(part)) return "-";
  return ltrDate(locales[lang], `${fmtNum(part * 100, lang, digits)} %`);
}

// Seconds -> "2d 09:14h" (days omitted below one day).
export function fmtDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const hm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}h`;
  return d > 0 ? `${d}d ${hm}` : hm;
}

// `timeZone`: a client component passes the server's zone (siteTimeZone),
// so that it renders the same text as the server and React does not throw
// the server's table away for a visitor in another zone.
export function fmtDateTime(unix: number | null | undefined, lang: Lang, timeZone?: string, timeStyle: "short" | "medium" = "short"): string {
  if (!unix) return "-";
  return dateFormat(locales[lang], timeZone ? { dateStyle: "medium", timeStyle, timeZone } : { dateStyle: "medium", timeStyle }).format(unix * 1000);
}

// Events and chat lines: the time with seconds, to see when exactly it happened.
export function fmtEventTime(unix: number | null | undefined, lang: Lang, timeZone?: string): string {
  return fmtDateTime(unix, lang, timeZone, "medium");
}

// The time zone the server renders dates in (TZ of the environment, else
// the system's), for client components that render the same dates.
export function siteTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function fmtDate(unix: number | null | undefined, lang: Lang): string {
  if (!unix) return "-";
  return dateFormat(locales[lang], { dateStyle: "medium" }).format(unix * 1000);
}

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

// Unix seconds -> "vor 5 Min." / "3 hr. ago"; null for under a minute.
export function fmtAge(unix: number | null | undefined, lang: Lang): string | null {
  if (!unix) return null;
  const s = nowUnix() - unix;
  if (s < 60) return null;
  const rtf = new Intl.RelativeTimeFormat(locales[lang], { numeric: "always", style: "short" });
  if (s < 3600) return rtf.format(-Math.floor(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), "hour");
  return rtf.format(-Math.floor(s / 86400), "day");
}

// Activity in percent: 100 right after playing, 0 after `days` days away.
export function activity(lastEvent: number, days: number): number {
  const away = (nowUnix() - lastEvent) / 86400;
  return Math.max(0, Math.min(100, Math.round(100 - (away * 100) / days)));
}

// Country flag emoji from a two-letter code.
export function flagEmoji(code: string | null | undefined): string {
  const c = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

// Country name of a two-letter code in the page language, e.g. a server's
// country_code; empty for an unknown code.
export function countryName(code: string | null | undefined, lang: Lang): string {
  const c = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  try {
    const name = new Intl.DisplayNames([locales[lang]], { type: "region" }).of(c);
    return name && name !== c ? name : "";
  } catch {
    return "";
  }
}

export { steamIds, steamSearchIds } from "./steam-id";

// BCP 47 locale of a language, for toLocaleString.
export function localeOf(lang: Lang): string {
  return locales[lang];
}

// Length of a ban in minutes as "2 d", "3 h" or "45 min".
export function fmtBanMinutes(m: number): string {
  if (m % 1440 === 0) return `${m / 1440} d`;
  if (m % 60 === 0) return `${m / 60} h`;
  return `${m} min`;
}
