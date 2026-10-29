import { enumArg, optionalEnumArg } from "./api-params.ts";
import { DEFAULT_PERIOD, EVENT_PERIODS, FILTER_KINDS, type EventPeriod, type FilterKind } from "./events-page.ts";

// Period and type filter of the events endpoints, as on the events page,
// and the details of an event. No database access, so `npm test` can load it.
export const PERIODS = Object.keys(EVENT_PERIODS) as EventPeriod[];

export function periodArg(q: { get(name: string): string | null }): EventPeriod {
  return enumArg(q, "period", PERIODS, DEFAULT_PERIOD);
}

export function typeArg(q: { get(name: string): string | null }): FilterKind | "" {
  return optionalEnumArg(q, "type", FILTER_KINDS);
}

// What an event carries besides the players: the weapon of a kill (with the
// headshot flag), the action and its bonus, the team or role, the old and
// new name.
export function eventDetail(kind: string, num: number, text: string, code: string) {
  const weapon = kind === "kill" || kind === "death" || kind === "suicide" || kind === "teamkill" ? { code, name: text || code } : null;
  const action = kind === "action" || kind === "playeraction" || kind === "teambonus" ? { code, name: text || code, bonus: Number(num) } : null;
  return {
    weapon: weapon && weapon.code ? weapon : null,
    headshot: kind === "kill" || kind === "death" ? Number(num) > 0 : null,
    action: action && (action.code || action.name) ? action : null,
    team: kind === "team" || kind === "role" ? { code, name: text || code } : null,
    oldName: kind === "name" ? text : null,
    newName: kind === "name" ? code : null,
  };
}
