import "server-only";
import { query, queryOne } from "./db";

// Kill heatmap of a map: kills counted in a grid over the positions the
// collector stores with each frag (hlstats_Events_Frags.pos_x/pos_y for the
// killer, pos_victim_x/pos_victim_y for the victim; Source games,
// collector 1.7) or, where that has more of them, from
// hlstats_Events_Locations (loc_1/loc_2; type 2 = where a player died,
// type 1 = where a killer stood), which the collector fills as well.
// Kept for ten minutes per map, a missing heatmap for one minute.

export type HeatWho = "victim" | "killer";

export type Heatmap = {
  cols: number;
  rows: number;
  // Game units covered by the grid (x to the right, y up).
  minX: number;
  minY: number;
  width: number;
  height: number;
  total: number;
  max: number;
  // [column, row, count]; row 0 is the lowest y.
  cells: [number, number, number][];
};

const GRID = 100;
const COLS: Record<HeatWho, [string, string]> = {
  victim: ["pos_victim_x", "pos_victim_y"],
  killer: ["pos_x", "pos_y"],
};

// Where the positions come from: table, x, y and the extra condition.
type Source = { table: string; x: string; y: string; where: string };

const LOCATIONS: Record<HeatWho, Source> = {
  victim: { table: "hlstats_Events_Locations", x: "loc_1", y: "loc_2", where: "type = 2" },
  killer: { table: "hlstats_Events_Locations", x: "loc_1", y: "loc_2", where: "type = 1" },
};

const cache = new Map<string, { at: number; value: Promise<Heatmap | null> }>();

export function getHeatmap(mapId: number, who: HeatWho): Promise<Heatmap | null> {
  const key = `${mapId}|${who}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 600_000) return hit.value;
  if (cache.size > 500) cache.clear();
  const at = Date.now();
  const value = load(mapId, who);
  cache.set(key, { at, value });
  // No heatmap (or an error) is asked again after a minute, so new
  // positions show up soon.
  value.then((h) => {
    if (!h) cache.set(key, { at: at - 540_000, value });
  });
  return value;
}

async function load(mapId: number, who: HeatWho): Promise<Heatmap | null> {
  const [x, y] = COLS[who];
  const frags: Source = { table: "hlstats_Events_Frags", x, y, where: "1 = 1" };
  // The source with more positions wins: older kills (CS:S before collector
  // 1.7.3) only have locations, newer ones have both.
  const [f, l] = await Promise.all([grid(mapId, frags).catch(() => null), grid(mapId, LOCATIONS[who]).catch(() => null)]);
  return f && (!l || f.total >= l.total) ? f : l;
}

async function grid(mapId: number, src: Source): Promise<Heatmap | null> {
  const { table, x, y, where } = src;
  const b = await queryOne<{ n: number; x0: number | null; x1: number | null; y0: number | null; y1: number | null }>(
    `SELECT COUNT(*) AS n, MIN(${x}) AS x0, MAX(${x}) AS x1, MIN(${y}) AS y0, MAX(${y}) AS y1
     FROM ${table} WHERE map = ? AND ${where} AND ${x} IS NOT NULL AND ${y} IS NOT NULL`,
    [mapId],
  );
  const n = Number(b?.n ?? 0);
  if (!b || n < 1 || b.x0 === null || b.x1 === null || b.y0 === null || b.y1 === null) return null;
  const minX = Math.floor(Number(b.x0));
  const minY = Math.floor(Number(b.y0));
  const width = Math.max(1, Math.ceil(Number(b.x1)) - minX + 1);
  const height = Math.max(1, Math.ceil(Number(b.y1)) - minY + 1);
  // Square cells: the longer side gets GRID cells.
  const cell = Math.max(width, height) / GRID;
  const cols = Math.max(1, Math.min(GRID, Math.ceil(width / cell)));
  const rows = Math.max(1, Math.min(GRID, Math.ceil(height / cell)));
  const rowsDb = await query<{ cx: number; cy: number; n: number }>(
    `SELECT FLOOR((${x} - ?) * ? / ?) AS cx, FLOOR((${y} - ?) * ? / ?) AS cy, COUNT(*) AS n
     FROM ${table} WHERE map = ? AND ${where} AND ${x} IS NOT NULL AND ${y} IS NOT NULL
     GROUP BY 1, 2`,
    [minX, cols, width, minY, rows, height, mapId],
  );
  const cells: [number, number, number][] = [];
  let max = 0;
  for (const r of rowsDb) {
    const c = Math.min(cols - 1, Math.max(0, Number(r.cx)));
    const rr = Math.min(rows - 1, Math.max(0, Number(r.cy)));
    const k = Number(r.n);
    cells.push([c, rr, k]);
    if (k > max) max = k;
  }
  return { cols, rows, minX, minY, width, height, total: n, max, cells };
}
