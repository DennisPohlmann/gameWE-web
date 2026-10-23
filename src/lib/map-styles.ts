// Tile sets for the player maps (components/player-map.tsx). All are free to
// use with the attribution shown; CARTO only for non-commercial sites up to
// 75,000 map views a month (https://carto.com/basemaps).

export type MapStyle = {
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
  // Dark look made from the light tiles with a CSS filter (globals.css .map-dark).
  dark?: boolean;
};

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CARTO = `${OSM} &copy; <a href="https://carto.com/attributions">CARTO</a>`;
const osm = { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: OSM, maxZoom: 19 };

export const mapStyles: Record<string, MapStyle> = {
  osm,
  "osm-dark": { ...osm, dark: true },
  hot: {
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    subdomains: "abc",
    attribution: `${OSM}, <a href="https://www.hotosm.org/">HOT</a>, <a href="https://openstreetmap.fr/">OSM France</a>`,
    maxZoom: 19,
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    attribution: `${OSM}, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)`,
    maxZoom: 17,
  },
  "carto-light": { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", subdomains: "abcd", attribution: CARTO, maxZoom: 19 },
  "carto-voyager": { url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", subdomains: "abcd", attribution: CARTO, maxZoom: 19 },
  "carto-dark": { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", subdomains: "abcd", attribution: CARTO, maxZoom: 19 },
};

// "auto" (default): OpenStreetMap, dark when the design has a dark background.
export function mapStyleId(v: string | undefined): string {
  const s = (v ?? "").trim();
  return s in mapStyles ? s : "auto";
}
