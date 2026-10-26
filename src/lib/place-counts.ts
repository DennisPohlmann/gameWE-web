// Players per location, counted once per ranking and then summed here for
// the Misc page (countries, connect methods) and the country, state and city
// selects of the player list. Counting over all players of a large ranking
// (hundreds of thousands after an HLstatsX import) takes a second or more, so
// data.ts reads the counts with one query and keeps them; everything below
// works on those few thousand rows. No imports, so the tests can load it
// directly.

// One row per location, connect method and hidden state of the players.
export type PlaceCount = {
  flag: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  // No location row (the player has no location yet, or it was deleted).
  located: boolean;
  type: number;
  hidden: boolean;
  n: number;
};

export type PlaceOption = { code: string; name: string; state: string; city: string; players: number };

// MariaDB's utf8mb4_unicode_ci groups names regardless of case, accents and
// trailing spaces; the sums here do the same, so both databases agree.
function fold(s: string) {
  return s.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const text = (s: string | null) => (s ?? "").trim();

// Countries of the ranked players with their flag, most players first;
// players without a location count as one entry with an empty flag.
export function miscCountries(rows: PlaceCount[]): { flag: string; country: string; n: number }[] {
  const out = new Map<string, { flag: string; country: string; n: number }>();
  for (const r of rows) {
    if (r.hidden) continue;
    const flag = text(r.flag);
    const country = text(r.country);
    const key = `${fold(flag)}|${fold(country)}`;
    const e = out.get(key) ?? { flag, country, n: 0 };
    e.n += r.n;
    out.set(key, e);
  }
  return [...out.values()].sort((a, b) => b.n - a.n);
}

// Connect methods of all players of the ranking (also hidden ones), most first.
export function connectTypes(rows: PlaceCount[]): { type: number; n: number }[] {
  const out = new Map<number, number>();
  for (const r of rows) if (r.type > 0) out.set(r.type, (out.get(r.type) ?? 0) + r.n);
  return [...out].map(([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n || a.type - b.type);
}

// States are names (GeoIP subdivision). HLstatsX stored legacy region codes
// of at most 3 characters ("02" for Bavaria) instead; the collector replaces
// them on the next lookup, until then such players are not counted.
export const isStateName = (s: string) => [...s].length > 3;

// Countries, states or cities with ranked players, most players first, for
// the selects above the ranking. country (a two-letter code) limits states
// and cities to one country.
export function placeOptions(rows: PlaceCount[], kind: "country" | "state" | "city", country = ""): PlaceOption[] {
  const out = new Map<string, PlaceOption>();
  for (const r of rows) {
    if (r.hidden || !r.located) continue;
    const flag = text(r.flag);
    if (!flag) continue;
    const code = flag.toLowerCase();
    if (country && code !== country) continue;
    const state = kind === "state" ? text(r.state) : "";
    const city = kind === "city" ? text(r.city) : "";
    if (kind === "state" && !isStateName(state)) continue;
    if (kind === "city" && !city) continue;
    const key = `${code}|${fold(state)}|${fold(city)}`;
    const e = out.get(key) ?? { code, name: "", state, city, players: 0 };
    // The name the database's MAX() would give.
    const name = text(r.country);
    if (name > e.name) e.name = name;
    e.players += r.n;
    out.set(key, e);
  }
  const by = kind === "state" ? "state" : kind === "city" ? "city" : "code";
  return [...out.values()]
    .sort((a, b) => b.players - a.players || (a[by] < b[by] ? -1 : a[by] > b[by] ? 1 : 0))
    .slice(0, kind === "country" ? 300 : 500);
}
