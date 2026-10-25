import "server-only";
import { query, queryOne } from "./db";
import { onLevel, type MapLevel } from "./map-levels";

// Kill and death positions of a map, drawn as dots like gameME's map
// tracking: from the positions the collector stores with each frag
// (hlstats_Events_Frags.pos_x/pos_y for the killer, with the headshot flag,
// pos_victim_x/pos_victim_y for the victim; Source games, collector 1.7) or,
// where that has more of them, from hlstats_Events_Locations (loc_1/loc_2;
// type 1 = where a killer stood, type 2 = where a player died; no headshot
// flag), which the collector fills as well. At most DOTS of the newest per
// kind. Kept for ten minutes per map, a missing one for one minute.

export type HeatWho = "victim" | "killer";

export type Heatmap = {
  // Game units covered by both kinds (x to the right, y up).
  minX: number;
  minY: number;
  width: number;
  height: number;
  // Positions stored per kind; the dots are the newest DOTS of them.
  kills: number;
  deaths: number;
  // [x, y, headshot 0/1] where killers stood.
  killDots: [number, number, number][];
  // [x, y] where players died.
  deathDots: [number, number][];
  // Height of each dot (pos_z, pos_victim_z), null where unknown; for maps
  // with two levels (map-levels.ts).
  killZ: (number | null)[];
  deathZ: (number | null)[];
};

export const DOTS = 3000;

// Where the positions come from: table, x, y, headshot, order and the extra
// condition.
type Source = { table: string; x: string; y: string; z: string; hs: string; order: string; where: string };

const FRAGS: Record<HeatWho, Source> = {
  killer: { table: "hlstats_Events_Frags", x: "pos_x", y: "pos_y", z: "pos_z", hs: "headshot", order: "timestamp_id", where: "1 = 1" },
  victim: { table: "hlstats_Events_Frags", x: "pos_victim_x", y: "pos_victim_y", z: "pos_victim_z", hs: "0", order: "timestamp_id", where: "1 = 1" },
};

const LOCATIONS: Record<HeatWho, Source> = {
  killer: { table: "hlstats_Events_Locations", x: "loc_1", y: "loc_2", z: "NULL", hs: "0", order: "day", where: "type = 1" },
  victim: { table: "hlstats_Events_Locations", x: "loc_1", y: "loc_2", z: "NULL", hs: "0", order: "day", where: "type = 2" },
};

type Dots = { n: number; dots: [number, number, number][]; z: (number | null)[] };

const cache = new Map<number, { at: number; value: Promise<Heatmap | null> }>();

export function getHeatmap(mapId: number): Promise<Heatmap | null> {
  const hit = cache.get(mapId);
  if (hit && Date.now() - hit.at < 600_000) return hit.value;
  if (cache.size > 500) cache.clear();
  const at = Date.now();
  const value = load(mapId);
  cache.set(mapId, { at, value });
  // No positions (or an error) are asked again after a minute, so new
  // positions show up soon.
  value.then((h) => {
    if (!h) cache.set(mapId, { at: at - 540_000, value });
  });
  return value;
}

async function load(mapId: number): Promise<Heatmap | null> {
  const [kills, deaths] = await Promise.all([best(mapId, "killer"), best(mapId, "victim")]);
  if (!kills && !deaths) return null;
  const all = [...(kills?.dots ?? []), ...(deaths?.dots ?? [])];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of all) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return {
    minX: x0,
    minY: y0,
    width: Math.max(1, x1 - x0),
    height: Math.max(1, y1 - y0),
    kills: kills?.n ?? 0,
    deaths: deaths?.n ?? 0,
    killDots: kills?.dots ?? [],
    deathDots: (deaths?.dots ?? []).map(([x, y]) => [x, y]),
    killZ: kills?.z ?? [],
    deathZ: deaths?.z ?? [],
  };
}

// One level of a map with two (map-levels.ts): the dots on it, in the frame
// of the whole map so both levels line up. The counts are the dots shown.
export function heatLevel(heat: Heatmap, split: number, level: MapLevel): Heatmap {
  const killDots = heat.killDots.filter((_, i) => onLevel(heat.killZ[i] ?? null, split, level));
  const deathDots = heat.deathDots.filter((_, i) => onLevel(heat.deathZ[i] ?? null, split, level));
  return {
    ...heat,
    kills: killDots.length,
    deaths: deathDots.length,
    killDots,
    deathDots,
    killZ: heat.killZ.filter((z) => onLevel(z, split, level)),
    deathZ: heat.deathZ.filter((z) => onLevel(z, split, level)),
  };
}

// The source with more positions wins: older kills (CS:S before collector
// 1.7.3) only have locations, newer ones have both.
async function best(mapId: number, who: HeatWho): Promise<Dots | null> {
  const [f, l] = await Promise.all([dots(mapId, FRAGS[who]).catch(() => null), dots(mapId, LOCATIONS[who]).catch(() => null)]);
  return f && (!l || f.n >= l.n) ? f : l;
}

async function dots(mapId: number, src: Source): Promise<Dots | null> {
  const { table, x, y, z, hs, order, where } = src;
  const cond = `map = ? AND ${where} AND ${x} IS NOT NULL AND ${y} IS NOT NULL`;
  const c = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${cond}`, [mapId]);
  const n = Number(c?.n ?? 0);
  if (n < 1) return null;
  const rows = await query<{ x: number; y: number; z: number | null; hs: number }>(
    `SELECT ${x} AS x, ${y} AS y, ${z} AS z, ${hs} AS hs FROM ${table} WHERE ${cond} ORDER BY ${order} DESC LIMIT ?`,
    [mapId, DOTS],
  );
  return {
    n,
    dots: rows.map((r) => [Math.round(Number(r.x)), Math.round(Number(r.y)), Number(r.hs) ? 1 : 0]),
    z: rows.map((r) => (r.z === null || r.z === undefined ? null : Number(r.z))),
  };
}
