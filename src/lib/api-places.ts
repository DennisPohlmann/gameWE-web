import "server-only";
import { apiPath } from "./api";
import { kpd, share } from "./api-params";
import { placeSorts, type PlaceRow, type PlaceSort } from "./data";
import type { PlaceKind } from "./places";

// Countries, states and cities in the public API (/api/v1/rankings/{game}/countries, /states, /cities).

export const PLACE_SORTS = Object.keys(placeSorts) as PlaceSort[];

// rank: place in this list (null when unknown).
export function apiPlace(game: string, r: PlaceRow, rank: number | null, kind: PlaceKind) {
  const code = r.code.trim().toUpperCase();
  const place: Record<string, string> = kind === "state" ? { state: r.state } : kind === "city" ? { city: r.city } : {};
  const filter = new URLSearchParams({ country: code.toLowerCase(), ...place });
  return {
    rank,
    country: { code, name: r.name ?? "" },
    ...place,
    players: r.players,
    skill: r.skill,
    avgSkill: r.avgSkill,
    kills: r.kills,
    deaths: r.deaths,
    headshots: r.headshots,
    kpd: kpd(r.kills, r.deaths),
    hpk: share(r.headshots, r.kills),
    connectionTime: r.connection_time,
    lastEvent: Number(r.last_event),
    // The ranked players of this place.
    playersUrl: `${apiPath(`/rankings/${game}/players`)}?${filter}`,
  };
}
