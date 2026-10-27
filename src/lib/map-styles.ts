// Tile sets for the player maps (components/player-map.tsx): OpenStreetMap
// only, free to use with the attribution shown. A stored style that is no
// longer offered (the former CARTO, HOT and OpenTopoMap styles) is "auto".

export type MapStyle = {
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
  // Dark look made from the light tiles with a CSS filter (globals.css .map-dark).
  dark?: boolean;
};

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const osm = { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: OSM, maxZoom: 19 };

export const mapStyles: Record<string, MapStyle> = {
  osm,
  "osm-dark": { ...osm, dark: true },
};

// "auto" (default): OpenStreetMap, dark when the design has a dark background.
export function mapStyleId(v: string | undefined): string {
  const s = (v ?? "").trim();
  return s in mapStyles ? s : "auto";
}
