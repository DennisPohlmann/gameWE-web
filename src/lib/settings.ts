import "server-only";
import { envBacked } from "./config";
import type { Lang } from "@/translations/languages";
import { eventsMode, type EventsMode } from "./events-mode";
import { query } from "./db";
import { esriKey, mapStyleId, satelliteId, type SatelliteId } from "./map-styles";
import { sourcebansBase } from "./sourcebans";
import { LINK_SLOTS, type HeaderLink, type TabId, headerOrder, parseHome, parseLink, safeUrl } from "./header-links";

export { LINK_SLOTS, safeUrl };
export type { HeaderLink };

// Site settings: hlstats_Options (editable in the admin area); the few that
// older installations set in the environment fall back to it (lib/config.ts).
// Cached for 30 seconds per server process.

// Search engine keywords when none are set in the admin area.
export const SEO_KEYWORDS = "game server statistics, player ranking, stats, awards, counter-strike, gameWE";

export type Settings = {
  siteName: string;
  // Search engines and link previews (Admin → Settings → SEO). An empty
  // description uses the default text in the visitor's language; an empty
  // image the logo.
  seoDescription: string;
  seoKeywords: string;
  seoImage: string;
  seoIndex: boolean;
  seoTwitter: string;
  activityDays: number;
  pageSize: number;
  // Language for visitors without a cookie or a matching browser language.
  defaultLang: Lang;
  // Steam avatars, names and VAC status from Steam (lib/steam.ts).
  steamProfiles: boolean;
  // Link of the site name in the breadcrumb, e.g. the community's homepage.
  siteUrl: string;
  // Image shown centred under the header (absolute URL or path).
  logoUrl: string;
  // Replaces the gameWE mark top left in the header; scaled to the header
  // height. Empty: the built-in mark.
  headerLogo: string;
  // Browser tab icon. Empty: the built-in icon.
  favicon: string;
  // Icon for phones (iOS share sheet, home screen), a PNG of 180 × 180.
  // Empty: the built-in one.
  appleIcon: string;
  // Browser title of a page, with {page} and {site}; on a ranking's pages
  // also {ranking}. See titleTemplate().
  titleFormat: string;
  titleFormatRanking: string;
  // Own tabs in the header by slot, from gamewe_link_1 .. gamewe_link_6
  // ("Label|URL"); null for an empty slot. See lib/header-links.ts.
  links: (HeaderLink | null)[];
  // Home tab (gamewe_header_home, empty parts: defaults) and the order of
  // all tabs (gamewe_header_order).
  headerHome: HeaderLink;
  headerOrder: TabId[];
  // Credit line for the GeoIP database the collector uses.
  geoipCredit: "dbip" | "maxmind" | "";
  // Text bottom right on the forum signature (default: the site name).
  sigBrand: string;
  // Chat on the public pages; otherwise only in the admin area.
  chatPublic: boolean;
  // Latest events on a ranking's start page and the recent kills and deaths
  // on a player's page: live (sync, new ones flow in), static (async, as
  // of loading the page) or off (not shown).
  gameEvents: EventsMode;
  playerEvents: EventsMode;
  // Game designs (templates/game-*) on the pages of a game; off unless set to "1".
  gameSkins: boolean;
  // Look of the site: dark (default), light, orange and others.
  // Template id (folder in templates/); see lib/templates.ts.
  skin: string;
  // Player maps: who is online (game overview) and the ranking's world map.
  mapLive: boolean;
  mapPlayers: boolean;
  // Tile set, see lib/map-styles.ts ("auto": matches the design).
  mapStyle: string;
  // Satellite view of the player maps (lib/map-styles.ts): provider or "off",
  // and the ArcGIS API key for Esri (public: it goes to the browser).
  mapSatellite: SatelliteId;
  mapEsriKey: string;
  // Base address of a SourceBans installation for the bans page.
  sourcebansUrl: string;
};

const linkKeys = Array.from({ length: LINK_SLOTS }, (_, i) => `gamewe_link_${i + 1}`);

// Image addresses from the settings: http(s) URL or a path on this host.
// No protocol-relative "//host", no quotes, spaces or angle brackets.
export function imageUrl(v: string | undefined): string {
  const s = (v ?? "").trim();
  if (s.length > 500 || /["'<>\\\s]/.test(s)) return "";
  return /^(https?:\/\/[^/]|\/(?!\/))/i.test(s) ? s : "";
}

export const TITLE_FORMAT = "{page} | {site}";
export const TITLE_FORMAT_RANKING = "{ranking} {page} | {site}";

function titleFormat(v: string | undefined, fallback: string): string {
  const s = (v ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  return s.includes("{page}") ? s : fallback;
}

// Title template for Next's metadata: {page} becomes %s. Without a page
// (start pages) {page} is left out together with the gap next to it.
export function titleTemplate(format: string, vars: Record<string, string>): { template: string; default: string } {
  const fill = (page: string) =>
    format.replace(/\{(site|ranking|page)\}/g, (_, k: string) => (k === "page" ? page : (vars[k] ?? "").replace(/%s/g, "")));
  const base = fill("\u0000")
    .replace(/\s*\u0000\s*/, " ")
    .replace(/^[\s|·:–-]+|[\s|·:–-]+$/g, "")
    .replace(/\s+([|·:–-])\s+[|·:–-]\s+/g, " $1 ")
    .replace(/\s+/g, " ");
  return { template: fill("%s"), default: base || vars.site || "" };
}

let cache: { at: number; value: Settings } | null = null;

function geoip(v: string | undefined): Settings["geoipCredit"] {
  const s = (v ?? "dbip").trim().toLowerCase();
  return s === "dbip" || s === "maxmind" ? s : "";
}

export function invalidateSettings() {
  cache = null;
}

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  let o: Record<string, string> = {};
  try {
    const rows = await query<{ keyname: string; value: string }>(
      `SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`,
      [["sitename", "MinActivity", "gamewe_page_size", "gamewe_default_lang", "gamewe_steam_profiles", "gamewe_site_url", "gamewe_logo_url", "gamewe_header_logo", "gamewe_favicon", "gamewe_apple_icon", "gamewe_title_format", "gamewe_title_ranking", "gamewe_geoip_credit", "gamewe_sig_brand", "gamewe_chat_public", "gamewe_game_events", "gamewe_player_events", "gamewe_skin", "gamewe_game_skins", "gamewe_map_live", "gamewe_map_players", "gamewe_map_style", "gamewe_map_satellite", "gamewe_map_esri_key", "gamewe_sourcebans_url", "gamewe_seo_description", "gamewe_seo_keywords", "gamewe_seo_image", "gamewe_seo_index", "gamewe_seo_twitter", "gamewe_header_home", "gamewe_header_order", ...linkKeys]],
    );
    o = Object.fromEntries(rows.map((r) => [r.keyname, r.value]));
  } catch {
    // Database down: fall back to the environment so the error page still has a title.
  }
  const base = envBacked(o);
  const value: Settings = {
    siteName: base.siteName,
    seoDescription: (o.gamewe_seo_description ?? "").trim().slice(0, 300),
    seoKeywords: (o.gamewe_seo_keywords ?? "").trim().slice(0, 255) || SEO_KEYWORDS,
    seoImage: safeUrl(o.gamewe_seo_image),
    seoIndex: o.gamewe_seo_index?.trim() !== "0",
    seoTwitter: /^@?[A-Za-z0-9_]{1,15}$/.test(o.gamewe_seo_twitter?.trim() ?? "") ? `@${o.gamewe_seo_twitter.trim().replace(/^@/, "")}` : "",
    activityDays: base.activityDays,
    pageSize: base.pageSize,
    defaultLang: base.defaultLang,
    steamProfiles: base.steamProfiles,
    siteUrl: safeUrl(o.gamewe_site_url),
    logoUrl: safeUrl(o.gamewe_logo_url),
    headerLogo: imageUrl(o.gamewe_header_logo),
    favicon: imageUrl(o.gamewe_favicon),
    appleIcon: imageUrl(o.gamewe_apple_icon),
    titleFormat: titleFormat(o.gamewe_title_format, TITLE_FORMAT),
    titleFormatRanking: titleFormat(o.gamewe_title_ranking, TITLE_FORMAT_RANKING),
    links: linkKeys.map((k) => parseLink(o[k])),
    headerHome: parseHome(o.gamewe_header_home),
    headerOrder: headerOrder(o.gamewe_header_order),
    geoipCredit: geoip(o.gamewe_geoip_credit),
    sigBrand: o.gamewe_sig_brand?.trim() || base.siteName,
    chatPublic: o.gamewe_chat_public?.trim() === "1",
    gameEvents: eventsMode(o.gamewe_game_events),
    playerEvents: eventsMode(o.gamewe_player_events),
    gameSkins: o.gamewe_game_skins?.trim() === "1",
    mapLive: o.gamewe_map_live?.trim() !== "0",
    mapPlayers: o.gamewe_map_players?.trim() !== "0",
    mapStyle: mapStyleId(o.gamewe_map_style),
    mapSatellite: satelliteId(o.gamewe_map_satellite),
    mapEsriKey: esriKey(o.gamewe_map_esri_key),
    sourcebansUrl: sourcebansBase(o.gamewe_sourcebans_url),
    skin: /^[a-z0-9][a-z0-9_-]{0,31}$/.test(o.gamewe_skin?.trim() ?? "") ? o.gamewe_skin.trim() : "dark",
  };
  cache = { at: Date.now(), value };
  return value;
}
