// Maps with two levels on top of each other (Counter-Strike 2): the heatmap
// shows the upper or the lower level alone, split at a fixed height (game
// units, pos_z of hlstats_Events_Frags). The heights are those of the maps'
// radar overviews (verticalsections, AltitudeMax of the lower level).
// Positions without a height (older rows, hlstats_Events_Locations) are left
// out of a level.

export type MapLevel = "upper" | "lower";

export const LEVEL_SPLITS: Record<string, number> = {
  de_nuke: -495,
  de_train: -50,
  de_vertigo: 11700,
};

// Only Counter-Strike 2 maps: the same map names in older games have other
// heights.
const LEVEL_GAMES = new Set(["cs2"]);

export function levelSplit(realgame: string | null | undefined, map: string): number | null {
  if (!LEVEL_GAMES.has((realgame ?? "").trim().toLowerCase())) return null;
  return LEVEL_SPLITS[map.trim().toLowerCase()] ?? null;
}

export function levelParam(v: string | undefined): MapLevel | null {
  return v === "upper" || v === "lower" ? v : null;
}

// Whether a position at height z lies on the level.
export function onLevel(z: number | null, split: number, level: MapLevel): boolean {
  if (z === null || !Number.isFinite(z)) return false;
  return level === "lower" ? z <= split : z > split;
}
