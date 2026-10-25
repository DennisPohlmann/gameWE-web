// Axes of the profile radar (K/D, kills per minute, assists per kill,
// survived and won rounds) and how values become radii. Pure functions,
// shared by the data layer (data.ts), the player page and the tests.
//
// The chart compares the player's last 14 days with all players of the game
// over the same 14 days. Every axis is a ratio num / den * mul of the daily
// history (hlstats_Players_History); the players' average is the pooled
// ratio sum(num) / sum(den) of all ranked players active in that time.
// The average sits at the middle ring (AVG_RING) of every axis and the
// player relative to it: the outer ring is twice the average (REL_MAX), so
// the rings read 0.5×, 1×, 1.5× and 2× the average. Where the average is
// zero (nothing to compare with), a fixed scale (FIXED_MAX) is used.
//
// The four core axes (K/D, kills per minute, survived, wins) are always
// drawn, in this order, so the chart keeps its diamond: K/D at the top,
// kills per minute on the right, survived at the bottom, wins on the left.
// An axis without data (the player has nothing to divide by: no rounds, no
// play time, no activity in the last 14 days; or the game records nothing
// for it: servers without win triggers count no wins) stays, marked noData,
// greyed at the centre. Assists are the only optional axis, placed between
// kills per minute and survived: drawn only when the game records them (an
// active player or the player has a non-zero value; CS:S logs none).

export const RADAR_KEYS = ["kpd", "kpm", "assists", "survived", "wins"] as const;
export type RadarKey = (typeof RADAR_KEYS)[number];

// Columns of hlstats_Players_History summed for each axis (constants only,
// see data.ts): numerator and denominator.
export const RADAR_SQL: Record<RadarKey, { num: string; den: string }> = {
  kpd: { num: "kills", den: "deaths" },
  kpm: { num: "kills", den: "connection_time" },
  assists: { num: "kill_assists", den: "kills" },
  survived: { num: "survived_count", den: "rounds" },
  wins: { num: "wins", den: "rounds" },
};

// Radius of the players' average.
export const AVG_RING = 0.5;
// Player value at the outer ring, as a multiple of the average.
export const REL_MAX = 1 / AVG_RING;
// Fixed scale (value at the outer ring) when there is no average.
export const FIXED_MAX: Record<RadarKey, number> = { kpd: 3, kpm: 2, assists: 0.5, survived: 1, wins: 1 };
// Shown value = num / den * mul (kills per minute from seconds).
const MUL: Record<RadarKey, number> = { kpd: 1, kpm: 60, assists: 1, survived: 1, wins: 1 };

export type Ratio = { num: number; den: number };
// The player's last 14 days; null: no activity at all.
export type PlayerRatios = Record<RadarKey, Ratio | null>;
// All active players of the game over the same days: how many, and the
// summed numerators and denominators per axis.
export type RadarAverage = { players: number; ratios: Record<RadarKey, Ratio> };

// A ratio that can be drawn: the denominator must be positive. K/D counts
// a player without deaths as one death (kpd() in format.ts).
export function axisRatio(key: RadarKey, r: Ratio | null): Ratio | null {
  if (!r) return null;
  const den = key === "kpd" ? Math.max(r.den, 1) : r.den;
  if (key === "kpd" && r.num + r.den <= 0) return null;
  return den > 0 && r.num >= 0 ? { num: r.num, den } : null;
}

export function axisValue(key: RadarKey, r: Ratio | null): number | null {
  const v = axisRatio(key, r);
  return v ? (v.num / v.den) * MUL[key] : null;
}

export type RadarPoint = {
  key: RadarKey;
  value: number | null; // the player's value; null: no data
  avg: number | null; // the players' average; null: no data
  r: number | null; // radius of the player 0..1
  rAvg: number; // radius of the average 0..1
  rel: number | null; // player / average; null: fixed scale or no data
  noData: boolean; // no value for this player (or the game): drawn greyed at the centre
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));

// The axes to draw, in RADAR_KEYS order: the four core axes, and assists
// when the game records them.
export function radarPoints(ratios: PlayerRatios, average: RadarAverage | null): RadarPoint[] {
  const out: RadarPoint[] = [];
  for (const key of RADAR_KEYS) {
    const value = axisValue(key, ratios[key]);
    const avg = axisValue(key, average?.ratios[key] ?? null);
    // No active player with a single non-zero value: the game does not record
    // this (unless the player has one: then it does).
    if (!avg && !value) {
      if (key === "assists") continue;
      // Without any average K/D and kills per minute stay at zero; the
      // round axes have no data.
      const unrecorded = avg !== null || (key !== "kpd" && key !== "kpm");
      out.push({ key, value, avg, r: value === null ? null : 0, rAvg: 0, rel: null, noData: value === null || unrecorded });
      continue;
    }
    if (avg) {
      const rel = value === null ? null : value / avg;
      out.push({ key, value, avg, r: rel === null ? null : clamp(rel * AVG_RING), rAvg: AVG_RING, rel, noData: value === null });
    } else {
      out.push({ key, value, avg, r: value === null ? null : clamp(value / FIXED_MAX[key]), rAvg: 0, rel: null, noData: value === null });
    }
  }
  return out;
}
