// Country, state and city rankings on /<game>/players, with gameME's
// parameters: ?type=countryinfo[&valuecountry=de],
// ?type=stateinfo[&valuecountry=de][&valuestate=bavaria],
// ?type=cityinfo[&valuecountry=de][&valuecity=madrid].

export type PlaceKind = "country" | "state" | "city";

export const placeTypes = { countryinfo: "country", stateinfo: "state", cityinfo: "city" } as const satisfies Record<string, PlaceKind>;
export type PlaceType = keyof typeof placeTypes;

// Longest state or city name taken from the address.
const NAME_MAX = 80;

export type PlaceQuery = {
  // "" for the plain player ranking.
  type: PlaceType | "";
  // Two-letter code, lower case, or "".
  country: string;
  // Lower case, only for that kind of ranking, else "".
  state: string;
  city: string;
};

// The state and city selects send "de:bavaria" when no country is chosen,
// so places with the same name in two countries stay apart.
export function parsePlaceQuery(raw: { type?: string; valuecountry?: string; valuestate?: string; valuecity?: string }): PlaceQuery {
  const type = Object.hasOwn(placeTypes, raw.type ?? "") ? (raw.type as PlaceType) : "";
  const kind = type ? placeTypes[type] : "";
  const rawName = (kind === "state" ? (raw.valuestate ?? "") : kind === "city" ? (raw.valuecity ?? "") : "").trim().toLowerCase();
  const prefixed = /^([a-z]{2}):(.+)$/.exec(rawName);
  const rawCountry = (prefixed?.[1] ?? raw.valuecountry ?? "").trim().toLowerCase();
  const country = /^[a-z]{2}$/.test(rawCountry) ? rawCountry : "";
  const name0 = prefixed?.[2] ?? rawName;
  const name = name0.length <= NAME_MAX && !/[\u0000-\u001f\u007f]/.test(name0) ? name0 : "";
  return { type, country, state: kind === "state" ? name : "", city: kind === "city" ? name : "" };
}

// Players of a country, state or city, in gameME's link form; state and
// city links also name the country, as a name can exist twice.
export function placeHref(game: string, country: string, city = "", state = ""): string {
  const c = country.toLowerCase();
  const withCountry: Record<string, string> = c ? { valuecountry: c } : {};
  const q = new URLSearchParams(
    city
      ? { type: "cityinfo", ...withCountry, valuecity: city.toLowerCase() }
      : state
        ? { type: "stateinfo", ...withCountry, valuestate: state.toLowerCase() }
        : { type: "countryinfo", valuecountry: c },
  );
  return `/${game}/players?${q}`;
}
