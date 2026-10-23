import "server-only";
import { config } from "./config";
import { query } from "./db";
import { mapStyleId } from "./map-styles";
import { sourcebansBase } from "./sourcebans";

// Site settings: hlstats_Options (editable in the admin area) wins over the
// environment. Cached for 30 seconds per server process.

export type HeaderLink = { label: string; url: string };

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
  // Tabs in the header, from gamewe_link_1 .. gamewe_link_6 ("Label|URL").
  links: HeaderLink[];
  // Credit line for the GeoIP database the collector uses.
  geoipCredit: "dbip" | "maxmind" | "";
  // Text bottom right on the forum signature (default: the site name).
  sigBrand: string;
  // Chat on the public pages; otherwise only in the admin area.
  chatPublic: boolean;
  // Latest events on a ranking's start page: live (new ones flow in),
  // static (as of loading the page) or off.
  gameEvents: "live" | "static" | "off";
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
  // Base address of a SourceBans installation for the bans page.
  sourcebansUrl: string;
};

export const LINK_SLOTS = 6;
const linkKeys = Array.from({ length: LINK_SLOTS }, (_, i) => `gamewe_link_${i + 1}`);

// Only http(s) URLs and site paths, so a setting cannot inject javascript: links.
export function safeUrl(v: string | undefined): string {
  const s = (v ?? "").trim();
  return /^(https?:\/\/|\/)/i.test(s) ? s : "";
}

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

function parseLink(v: string | undefined): HeaderLink | null {
  const [label, url] = (v ?? "").split("|").map((x) => x.trim());
  const safe = safeUrl(url);
  return label && safe ? { label, url: safe } : null;
}

let cache: { at: number; value: Settings } | null = null;

function positive(v: string | undefined, fallback: number, max: number) {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
}

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
      [["sitename", "MinActivity", "gamewe_page_size", "gamewe_site_url", "gamewe_logo_url", "gamewe_header_logo", "gamewe_favicon", "gamewe_apple_icon", "gamewe_title_format", "gamewe_title_ranking", "gamewe_geoip_credit", "gamewe_sig_brand", "gamewe_chat_public", "gamewe_game_events", "gamewe_skin", "gamewe_game_skins", "gamewe_map_live", "gamewe_map_players", "gamewe_map_style", "gamewe_sourcebans_url", "gamewe_seo_description", "gamewe_seo_keywords", "gamewe_seo_image", "gamewe_seo_index", "gamewe_seo_twitter", ...linkKeys]],
    );
    o = Object.fromEntries(rows.map((r) => [r.keyname, r.value]));
  } catch {
    // Database down: fall back to the environment so the error page still has a title.
  }
  const value: Settings = {
    siteName: o.sitename?.trim() || config.siteName,
    seoDescription: (o.gamewe_seo_description ?? "").trim().slice(0, 300),
    seoKeywords: (o.gamewe_seo_keywords ?? "").trim().slice(0, 255) || SEO_KEYWORDS,
    seoImage: safeUrl(o.gamewe_seo_image),
    seoIndex: o.gamewe_seo_index?.trim() !== "0",
    seoTwitter: /^@?[A-Za-z0-9_]{1,15}$/.test(o.gamewe_seo_twitter?.trim() ?? "") ? `@${o.gamewe_seo_twitter.trim().replace(/^@/, "")}` : "",
    activityDays: positive(o.MinActivity, config.activityDays, 3650),
    pageSize: positive(o.gamewe_page_size, config.pageSize, 500),
    siteUrl: safeUrl(o.gamewe_site_url),
    logoUrl: safeUrl(o.gamewe_logo_url),
    headerLogo: imageUrl(o.gamewe_header_logo),
    favicon: imageUrl(o.gamewe_favicon),
    appleIcon: imageUrl(o.gamewe_apple_icon),
    titleFormat: titleFormat(o.gamewe_title_format, TITLE_FORMAT),
    titleFormatRanking: titleFormat(o.gamewe_title_ranking, TITLE_FORMAT_RANKING),
    links: linkKeys.map((k) => parseLink(o[k])).filter((l): l is HeaderLink => l !== null),
    geoipCredit: geoip(o.gamewe_geoip_credit),
    sigBrand: o.gamewe_sig_brand?.trim() || o.sitename?.trim() || config.siteName,
    chatPublic: o.gamewe_chat_public?.trim() === "1",
    gameEvents: o.gamewe_game_events?.trim() === "static" ? "static" : o.gamewe_game_events?.trim() === "off" ? "off" : "live",
    gameSkins: o.gamewe_game_skins?.trim() === "1",
    mapLive: o.gamewe_map_live?.trim() !== "0",
    mapPlayers: o.gamewe_map_players?.trim() !== "0",
    mapStyle: mapStyleId(o.gamewe_map_style),
    sourcebansUrl: sourcebansBase(o.gamewe_sourcebans_url),
    skin: /^[a-z0-9][a-z0-9_-]{0,31}$/.test(o.gamewe_skin?.trim() ?? "") ? o.gamewe_skin.trim() : "dark",
  };
  cache = { at: Date.now(), value };
  return value;
}
