// Query parameters and paging of the public API (/api/v1/...). Pure
// functions without database access, so `npm test` can run them.
//
// Every list answers { data, pagination, links }. Invalid parameters are
// refused with 400 (ApiError) instead of being clamped, so a client notices
// a typo; parameters the endpoint does not know are ignored.

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;
// Deeper pages scan too much of a ranking for a public, unauthenticated API.
export const MAX_OFFSET = 1_000_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const bad = (message: string) => new ApiError(400, message);

type Query = { get(name: string): string | null };

// Integer parameter in [min, max]; def when absent, 400 when malformed.
export function intArg(q: Query, name: string, def: number, min: number, max: number): number {
  const v = q.get(name);
  if (v === null) return def;
  if (!/^\d{1,9}$/.test(v) || Number(v) < min || Number(v) > max) throw bad(`invalid ${name}: integer from ${min} to ${max}`);
  return Number(v);
}

// Optional parameter that must be one of `allowed`.
export function enumArg<T extends string>(q: Query, name: string, allowed: readonly T[], def: T): T {
  const v = q.get(name);
  if (v === null) return def;
  if (!(allowed as readonly string[]).includes(v)) throw bad(`invalid ${name}: one of ${allowed.join(", ")}`);
  return v as T;
}

// Optional free text (name search, city): trimmed, at most `max` characters,
// no control characters; "" when absent.
export function textArg(q: Query, name: string, max: number): string {
  const v = q.get(name);
  if (v === null) return "";
  const s = v.trim();
  if (s.length > max || /[\u0000-\u001f\u007f]/.test(s)) throw bad(`invalid ${name}: at most ${max} characters, no control characters`);
  return s;
}

// Two-letter country code, lower case; "" when absent.
export function countryArg(q: Query, name = "country"): string {
  const v = q.get(name);
  if (v === null || v === "") return "";
  if (!/^[A-Za-z]{2}$/.test(v)) throw bad(`invalid ${name}: ISO 3166-1 alpha-2 code`);
  return v.toLowerCase();
}

// Day as YYYY-MM-DD (a real calendar day); "" when absent.
export function dayArg(q: Query, name = "day"): string {
  const v = q.get(name);
  if (v === null || v === "") return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  if (!d || d.toISOString().slice(0, 10) !== v) throw bad(`invalid ${name}: date as YYYY-MM-DD`);
  return v;
}

// Positive id from the path (digits only, as the website parses it); null
// for anything else, which the routes answer with 404.
export function pathId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

export type Sort<K extends string> = { sort: K; asc: boolean };

// sort (one of the keys) and order (asc/desc); without order each key has
// its natural direction (names ascending, numbers descending). aliases are
// other names for a key (points for skill, as the website calls it).
export function sortArg<K extends string>(q: Query, keys: readonly K[], def: K, ascByDefault: readonly K[] = [], aliases: Readonly<Record<string, K>> = {}): Sort<K> {
  const raw = q.get("sort");
  const alias = raw !== null && Object.hasOwn(aliases, raw) ? aliases[raw] : undefined;
  if (raw !== null && !alias && !(keys as readonly string[]).includes(raw)) throw bad(`invalid sort: one of ${[...keys, ...Object.keys(aliases)].join(", ")}`);
  const sort = alias ?? (raw === null ? def : (raw as K));
  const order = q.get("order") === null ? null : enumArg(q, "order", ["asc", "desc"] as const, "desc");
  return { sort, asc: order ? order === "asc" : ascByDefault.includes(sort) };
}

export type Paging = { page: number; limit: number; offset: number };

// limit (1-100), and page (from 1) or offset (rows to skip), not both.
export function pagingArg(q: Query, defLimit = DEFAULT_LIMIT): Paging {
  const limit = intArg(q, "limit", defLimit, 1, MAX_LIMIT);
  if (q.get("page") !== null && q.get("offset") !== null) throw bad("use page or offset, not both");
  if (q.get("offset") !== null) {
    const offset = intArg(q, "offset", 0, 0, MAX_OFFSET);
    return { page: Math.floor(offset / limit) + 1, limit, offset };
  }
  const page = intArg(q, "page", 1, 1, Math.floor(MAX_OFFSET / limit) + 1);
  return { page, limit, offset: (page - 1) * limit };
}

export type Pagination = { page: number; limit: number; offset: number; total: number; totalPages: number };
export type Links = { self: string; first: string; prev: string | null; next: string | null; last: string };
export type Page<T> = { data: T[]; pagination: Pagination; links: Links };

// The answer of a list. `path` is the endpoint's path (with base path),
// `args` the validated, non-default parameters of the request: links repeat
// them, never the raw query string.
export function paged<T>(data: T[], total: number, p: Paging, path: string, args: Record<string, string | number | undefined> = {}): Page<T> {
  const totalPages = Math.max(1, Math.ceil(total / p.limit));
  const url = (page: number) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(args)) if (v !== undefined && v !== "") s.set(k, String(v));
    if (p.limit !== DEFAULT_LIMIT) s.set("limit", String(p.limit));
    if (page > 1) s.set("page", String(page));
    const qs = s.toString();
    return qs ? `${path}?${qs}` : path;
  };
  // A request by offset that is not on a page boundary links to itself by offset.
  const aligned = p.offset === (p.page - 1) * p.limit;
  const self = aligned ? url(p.page) : `${url(1)}${url(1).includes("?") ? "&" : "?"}offset=${p.offset}`;
  return {
    data,
    pagination: { page: p.page, limit: p.limit, offset: p.offset, total, totalPages },
    links: {
      self,
      first: url(1),
      prev: p.page > 1 ? url(Math.min(p.page - 1, totalPages)) : null,
      next: p.page < totalPages ? url(p.page + 1) : null,
      last: url(totalPages),
    },
  };
}

// One page of a list that is already complete in memory (weapons, maps).
export function pageOf<T>(all: T[], p: Paging): T[] {
  return all.slice(p.offset, p.offset + p.limit);
}

// Sorts a copy of `rows` by `key` (numbers or strings), ties by `tie`.
export function sortRows<T>(rows: T[], key: (r: T) => number | string, asc: boolean, tie: (r: T) => number): T[] {
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const c = typeof x === "string" || typeof y === "string" ? String(x).localeCompare(String(y)) : x - y;
    return (asc ? c : -c) || tie(a) - tie(b);
  });
}

export const kpd = (kills: number, deaths: number) => Math.round((Number(kills) / Math.max(1, Number(deaths))) * 100) / 100;
// Share as a fraction with four decimals (0.3125 = 31.25 %), null without a base.
export const share = (part: number, base: number) => (Number(base) > 0 ? Math.round((Number(part) / Number(base)) * 10000) / 10000 : null);
