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

// Satellite view of the player maps: a "Map / Satellite" switch in the map
// (components/player-map.tsx) shows these layers instead of the map style:
// the imagery first, then transparent labels (places, roads and their
// names) over it, like Google's satellite view with labels.
//  - eox: Sentinel-2 cloudless by EOX (Vienna), no key; CC BY-NC-SA 4.0,
//    free for non-commercial sites with the credit. About 10 m per pixel:
//    sharp down to a city, blurred closer in. Labels: EOX's overlay of
//    OpenStreetMap data (place names, roads and street names), no key.
//  - esri: Esri World Imagery, sharp down to streets, with Esri's own labels
//    and roads. Free only with a (free) ArcGIS account and its API key, no
//    revenue and under 1 million tiles a month (Esri's terms).
//  - off: no switch.
export const SATELLITES = ["eox", "esri", "off"] as const;
export type SatelliteId = (typeof SATELLITES)[number];

export function satelliteId(v: string | undefined): SatelliteId {
  const s = (v ?? "").trim();
  return (SATELLITES as readonly string[]).includes(s) ? (s as SatelliteId) : "eox";
}

// An ArcGIS API key: it goes to every visitor's browser in the tile
// addresses (Esri keys are public and limited to the site's domain in the
// ArcGIS account), so only the characters a key has; anything else: none.
export function esriKey(v: string | undefined): string {
  const s = (v ?? "").trim();
  return /^[A-Za-z0-9._-]{20,255}$/.test(s) ? s : "";
}

// Year of the Sentinel-2 cloudless layer (EOX publishes one a year).
const EOX_YEAR = 2025;
const EOX = `<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data ${EOX_YEAR})`;
const EOX_LABELS = `${OSM}, rendering &copy; <a href="https://eox.at">EOX</a> and <a href="https://github.com/mapserver/basemaps">MapServer</a>`;
const ESRI = 'Powered by <a href="https://www.esri.com">Esri</a> | Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

// The layers of the satellite view, bottom first; none when it is off.
export function satelliteLayers(id: SatelliteId, key = ""): MapStyle[] {
  if (id === "eox") {
    return [
      { url: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${EOX_YEAR}_3857/default/g/{z}/{y}/{x}.jpg`, attribution: EOX, maxZoom: 18 },
      { url: "https://tiles.maps.eox.at/wmts/1.0.0/overlay_bright_3857/default/g/{z}/{y}/{x}.png", attribution: EOX_LABELS, maxZoom: 18 },
    ];
  }
  if (id === "esri") {
    const token = key ? `?token=${encodeURIComponent(key)}` : "";
    // With a key the imagery comes from Esri's basemap service for API keys
    // (as in Esri's own samples); the labels and roads stay on the public
    // host, with the key added like esri-leaflet does.
    const esri = (service: string, attribution = "", host = "https://server.arcgisonline.com/ArcGIS") => ({
      url: `${host}/rest/services/${service}/MapServer/tile/{z}/{y}/{x}${token}`,
      attribution,
      maxZoom: 19,
    });
    return [esri("World_Imagery", ESRI, key ? "https://ibasemaps-api.arcgis.com/arcgis" : undefined), esri("Reference/World_Transportation"), esri("Reference/World_Boundaries_and_Places")];
  }
  return [];
}

// What a player map needs for its "Map / Satellite" switch: the layers and
// the button texts (the page's language).
export type MapSatellite = { layers: MapStyle[]; map: string; satellite: string; label: string };

export function mapSatellite(
  s: { mapSatellite: SatelliteId; mapEsriKey: string },
  t: { mapViewMap: string; mapViewSatellite: string; mapView: string },
): MapSatellite | undefined {
  const layers = satelliteLayers(s.mapSatellite, s.mapEsriKey);
  return layers.length ? { layers, map: t.mapViewMap, satellite: t.mapViewSatellite, label: t.mapView } : undefined;
}
