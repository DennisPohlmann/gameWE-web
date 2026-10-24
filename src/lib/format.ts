import { LANGUAGES, type Lang } from "@/translations/languages";

const locales = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.locale])) as Record<Lang, string>;

// toLocaleString builds a new formatter on every call, which costs about
// 0.3 ms; the charts format thousands of times per page. These keep one
// formatter per locale and options.
const formatters = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

export function dateFormat(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d|${locale}|${JSON.stringify(opts)}`;
  let f = formatters.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) formatters.set(key, (f = new Intl.DateTimeFormat(locale, opts)));
  return f;
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

export function fmtPct(part: number | null | undefined, lang: Lang, digits = 0): string {
  if (part === null || part === undefined || !Number.isFinite(part)) return "-";
  return `${fmtNum(part * 100, lang, digits)} %`;
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

export function fmtDateTime(unix: number | null | undefined, lang: Lang): string {
  if (!unix) return "-";
  return dateFormat(locales[lang], { dateStyle: "medium", timeStyle: "short" }).format(unix * 1000);
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

// "STEAM_0:1:123" or "1:123" -> Steam IDs. Bots and unknown formats return null.
// CS:GO logs "[U:1:123]" or a SteamID64 instead, so those work too.
export function steamIds(uniqueId: string | null | undefined) {
  const s = (uniqueId ?? "").trim();
  const base = 76561197960265728n;
  let account: bigint;
  const m = /^(?:STEAM_\d:)?([01]):(\d{1,10})$/.exec(s);
  const u = /^\[?U:1:(\d{1,10})\]?$/.exec(s);
  if (m) account = BigInt(m[2]) * 2n + BigInt(m[1]);
  else if (u) account = BigInt(u[1]);
  else if (/^7656119\d{10}$/.test(s) && BigInt(s) > base) account = BigInt(s) - base;
  else return null;
  if (account <= 0n || account >= 2n ** 32n) return null;
  return {
    steam2: `STEAM_0:${account % 2n}:${account / 2n}`,
    steam3: `[U:1:${account}]`,
    steam64: String(76561197960265728n + account),
  };
}

// BCP 47 locale of a language, for toLocaleString.
export function localeOf(lang: Lang): string {
  return locales[lang];
}
