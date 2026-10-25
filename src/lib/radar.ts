// Axes of the profile radar (K/D, kills per minute, assists per kill,
// survived and won rounds) and how a player's values become radii. Pure
// functions, shared by the data layer (data.ts), the player page and the
// tests.
//
// Every axis is a ratio num / den * mul of hlstats_Players columns. The
// radius is the player's percentile among the ranked players of the same
// game (share of them with a lower value), so axes with very different
// units fit one chart. With too few players to compare, a fixed scale
// (FIXED_MAX) is used instead. An axis is left out when the game records no
// data for it (no comparable player has a non-zero value: CS:S logs no
// assists, servers without win triggers count no wins), as long as three
// axes remain. When the player has nothing to divide by (no rounds, no play
// time) the axis stays, marked noData, at the centre: the chart keeps its
// shape and never falls below three axes.

export const RADAR_KEYS = ["kpd", "kpm", "assists", "survived", "wins"] as const;
export type RadarKey = (typeof RADAR_KEYS)[number];

// SQL of each axis over hlstats_Players (constants only, see data.ts):
// numerator, denominator, and when a row has a value at all.
export const RADAR_SQL: Record<RadarKey, { num: string; den: string; valid: string }> = {
  kpd: { num: "kills", den: "GREATEST(deaths, 1)", valid: "kills + deaths > 0" },
  kpm: { num: "kills", den: "connection_time", valid: "connection_time > 0" },
  assists: { num: "kill_assists", den: "kills", valid: "kills > 0" },
  survived: { num: "survived_count", den: "rounds", valid: "rounds > 0" },
  wins: { num: "wins", den: "rounds", valid: "rounds > 0" },
};

// Players compared with: ranked (not hidden) and at least this many kills.
export const RADAR_MIN_KILLS = 10;
// Fewer comparable players than this: fixed scale instead of percentiles.
export const RADAR_MIN_PLAYERS = 5;
// Fixed scale (value at the outer ring) when percentiles are not possible.
export const FIXED_MAX: Record<RadarKey, number> = { kpd: 3, kpm: 2, assists: 0.5, survived: 1, wins: 1 };
// Shown value = num / den * mul (kills per minute from seconds).
const MUL: Record<RadarKey, number> = { kpd: 1, kpm: 60, assists: 1, survived: 1, wins: 1 };

export type Ratio = { num: number; den: number };
export type PlayerRatios = Record<RadarKey, { total: Ratio; current: Ratio | null }>;

// Per axis from the database: comparable players, those with a non-zero
// value, and those below the player's total and current value.
export type AxisRank = { n: number; nonZero: number; belowTotal: number; belowCurrent: number | null };

// A ratio that can be drawn: the denominator must be positive. K/D counts
// a player without deaths as one death (kpd() in format.ts, GREATEST in SQL).
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
  total: number; // value
  current: number | null;
  rTotal: number; // radius 0..1
  rCurrent: number | null;
  pctTotal: number | null; // share of compared players below, 0..1; null: fixed scale
  pctCurrent: number | null;
  noData: boolean; // no value for this player (or the game): drawn greyed at the centre
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));

// The axes to draw, in RADAR_KEYS order, at least three of them.
export function radarPoints(ratios: PlayerRatios, ranks: Partial<Record<RadarKey, AxisRank>>): RadarPoint[] {
  const out: RadarPoint[] = [];
  // Axes the game does not record: only used to fill up to three axes.
  const unrecorded = new Set<RadarKey>();
  for (const key of RADAR_KEYS) {
    const total = axisValue(key, ratios[key].total);
    const rank = ranks[key];
    if (total === null) {
      out.push({ key, total: 0, current: null, rTotal: 0, rCurrent: null, pctTotal: null, pctCurrent: null, noData: true });
      continue;
    }
    // Compared players without a single non-zero value: the game does not
    // record this (unless the player has one: then it does). Without ranks
    // only K/D and kills per minute are shown at zero.
    if ((rank && rank.nonZero === 0 && total === 0) || (!rank && total === 0 && key !== "kpd" && key !== "kpm")) {
      unrecorded.add(key);
      out.push({ key, total, current: null, rTotal: 0, rCurrent: null, pctTotal: null, pctCurrent: null, noData: true });
      continue;
    }
    const current = axisValue(key, ratios[key].current);
    const usePct = !!rank && rank.n >= RADAR_MIN_PLAYERS;
    const pct = (below: number | null) => (usePct && below !== null ? clamp(below / rank.n) : null);
    const pctTotal = pct(rank?.belowTotal ?? null);
    const pctCurrent = current === null ? null : pct(rank?.belowCurrent ?? null);
    out.push({
      key,
      total,
      current,
      rTotal: usePct ? (pctTotal ?? 0) : clamp(total / FIXED_MAX[key]),
      rCurrent: current === null ? null : usePct ? (pctCurrent ?? 0) : clamp(current / FIXED_MAX[key]),
      pctTotal,
      pctCurrent,
      noData: false,
    });
  }
  // Unrecorded axes are dropped while more than three axes remain.
  let drop = Math.min(unrecorded.size, out.length - 3);
  return out.filter((p) => !(unrecorded.has(p.key) && drop-- > 0));
}
