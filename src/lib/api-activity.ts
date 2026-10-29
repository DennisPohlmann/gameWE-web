import { enumArg } from "./api-params.ts";

// The activity per 15 minutes (getHourlyActivity) of the API. The days are
// those of the website's charts (and two shorter ones), so every answer
// comes from the same few cached reads. No database access (npm test).
export const ACTIVITY_DAYS = ["1", "7", "14", "30"] as const;

export function activityDaysArg(q: { get(name: string): string | null }, def: 14 | 30): number {
  return Number(enumArg(q, "days", ACTIVITY_DAYS, String(def) as (typeof ACTIVITY_DAYS)[number]));
}

// One entry per 15 minutes, oldest first. players and servers are null
// where the collector recorded no load.
export function activitySeries(h: { start: number; step: number; players: (number | null)[]; servers: (number | null)[]; kills: number[]; headshots: number[] }) {
  return {
    step: h.step,
    data: h.kills.map((kills, i) => ({ time: h.start + i * h.step, players: h.players[i], servers: h.servers[i], kills, headshots: h.headshots[i] })),
  };
}
