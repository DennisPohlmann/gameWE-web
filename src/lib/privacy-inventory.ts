// What the privacy page lists on its own: the cookies and browser storage
// the site uses, and the other hosts that a visitor's browser loads from
// (they see the visitor's IP address) or that the server asks (they never
// see it). Built from the settings, so it follows what is switched on.
// Keep it in step with the code: every new cookie, storage key or outside
// host belongs here (and, when the browser loads it, behind a consent
// category of lib/consent.ts). Pure functions for the page and the tests.

import type { ConsentCategory } from "./consent";

// Texts are keys of the "privacy" group of the translations.
export type StorageRow = {
  name: string;
  kind: "cookie" | "local";
  purpose: string;
  duration: string;
  // Category: necessary for the site, or a setting the visitor made.
  category: "necessary" | "preference";
  adminOnly?: boolean;
};

export type ThirdPartyRow = {
  provider: string;
  hosts: string[];
  purpose: string;
  data: string;
  // The consent category that gates it; null: loaded without consent
  // (pictures the operator set up) or asked by the server.
  consent: ConsentCategory | null;
  link?: string;
};

export type InventoryInput = {
  mapStyle: string;
  // Map boxes shown at all (Admin → Maps).
  maps: boolean;
  steamProfiles: boolean;
  voice: "none" | "teamspeak" | "discord";
  sourcebans: boolean;
  // Picture addresses from the settings (logo, header logo, icons).
  images: string[];
  // Host of the page itself, so own pictures are not listed.
  ownHost: string;
};

export const STORAGE: StorageRow[] = [
  { name: "gamewe_consent", kind: "cookie", purpose: "stConsent", duration: "dur12m", category: "necessary" },
  { name: "gamewe_lang", kind: "cookie", purpose: "stLang", duration: "dur12m", category: "preference" },
  { name: "gamewe-live-events", kind: "local", purpose: "stLive", duration: "durUntilDeleted", category: "preference" },
  { name: "gamewe-live-player-events", kind: "local", purpose: "stLive", duration: "durUntilDeleted", category: "preference" },
  { name: "gamewe_session", kind: "cookie", purpose: "stSession", duration: "dur12h", category: "necessary", adminOnly: true },
  { name: "gamewe_2fa", kind: "cookie", purpose: "st2fa", duration: "dur5min", category: "necessary", adminOnly: true },
  { name: "gamewe_admin_theme", kind: "cookie", purpose: "stAdminTheme", duration: "dur12m", category: "preference", adminOnly: true },
];

type Tiles = { provider: string; hosts: string[]; link: string };

const OSM: Tiles = { provider: "OpenStreetMap Foundation", hosts: ["tile.openstreetmap.org"], link: "https://osmfoundation.org/wiki/Privacy_Policy" };
const TILES: Record<string, Tiles> = {
  auto: OSM,
  osm: OSM,
  "osm-dark": OSM,
};

export function tileProvider(style: string): Tiles {
  return TILES[style] ?? OSM;
}

// Other hosts of the pictures from the settings (relative paths are ours).
export function imageHosts(urls: string[], ownHost: string): string[] {
  const hosts = new Set<string>();
  for (const u of urls) {
    if (!/^https?:\/\//i.test(u)) continue;
    try {
      const h = new URL(u).host.toLowerCase();
      if (h && h !== ownHost.toLowerCase()) hosts.add(h);
    } catch {}
  }
  return [...hosts].sort();
}

const BROWSER_DATA = "dataBrowser";

// Hosts the visitor's browser loads from.
export function browserThirdParties(i: InventoryInput): ThirdPartyRow[] {
  const rows: ThirdPartyRow[] = [];
  if (i.steamProfiles) {
    rows.push({
      provider: "Valve Corporation (Steam)",
      hosts: ["avatars.steamstatic.com", "avatars.fastly.steamstatic.com", "avatars.akamai.steamstatic.com"],
      purpose: "tpSteamImages",
      data: BROWSER_DATA,
      consent: "steam",
      link: "https://store.steampowered.com/privacy_agreement/",
    });
  }
  if (i.maps) {
    const t = tileProvider(i.mapStyle);
    rows.push({ provider: t.provider, hosts: t.hosts, purpose: "tpTiles", data: BROWSER_DATA, consent: "maps", link: t.link });
  }
  const own = imageHosts(i.images, i.ownHost);
  if (own.length) rows.push({ provider: "", hosts: own, purpose: "tpOperatorImages", data: BROWSER_DATA, consent: null });
  return rows;
}

// Hosts only the server asks; the visitor's IP address does not reach them.
export function serverThirdParties(i: InventoryInput): ThirdPartyRow[] {
  const rows: ThirdPartyRow[] = [];
  if (i.steamProfiles) {
    rows.push({ provider: "Valve Corporation (Steam Web API)", hosts: ["api.steampowered.com", "steamcommunity.com"], purpose: "tpSteamApi", data: "dataSteamId", consent: null });
  }
  if (i.voice === "discord") rows.push({ provider: "Discord", hosts: ["discord.com"], purpose: "tpDiscord", data: "dataNone", consent: null });
  if (i.voice === "teamspeak") rows.push({ provider: "TeamSpeak", hosts: [], purpose: "tpTeamspeak", data: "dataNone", consent: null });
  if (i.sourcebans) rows.push({ provider: "SourceBans", hosts: [], purpose: "tpSourcebans", data: "dataNone", consent: null });
  rows.push({ provider: "GitHub", hosts: ["api.github.com"], purpose: "tpGithub", data: "dataNone", consent: null });
  return rows;
}
