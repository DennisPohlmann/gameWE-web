import "server-only";
import type { MapMarker, ServerMarker } from "@/components/player-map";
import { basePath } from "./base-path";
import type { MapPlayer, MapServer } from "./data";
import { FLAG_CODES } from "./flag-codes";
import { flagEmoji, fmtDate, fmtNum, kpd } from "./format";
import type { Dict, Lang } from "./i18n";

// Markers for the player map: avatar, link and the hover lines per player.
export function mapMarkers(players: (MapPlayer & { server?: string | null })[], game: string, t: Dict, lang: Lang): MapMarker[] {
  return players.map((p) => {
    const name = p.name ?? `#${p.playerId}`;
    const code = (p.flag ?? "").trim().toLowerCase();
    const svg = FLAG_CODES.has(code);
    return {
      id: p.playerId,
      name,
      href: `${basePath}/${game}/players/${p.playerId}`,
      avatar: `${basePath}/avatar/${p.playerId}`,
      initial: name.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "?",
      lat: p.lat,
      lng: p.lng,
      flag: svg ? `${basePath}/flags/${code}.svg` : undefined,
      lines: [
        svg ? name : `${flagEmoji(p.flag)} ${name}`.trim(),
        [p.city, p.country].filter(Boolean).join(", "),
        `${p.rank ? `${t.rank}: ${fmtNum(p.rank, lang)} · ` : ""}${t.points}: ${fmtNum(p.skill, lang)} · ${t.kills}: ${fmtNum(p.kills, lang)} · ${t.kpd}: ${kpd(p.kills, p.deaths).toFixed(2)}`,
        p.server ? `${t.server}: ${p.server}` : `${t.lastConnect}: ${fmtDate(p.last_event, lang)}`,
      ].filter(Boolean),
    };
  });
}

// Markers for the game servers on the player map: link to the server page
// and the hover lines (name, place, address as in the server list, map).
export function serverMarkers(servers: MapServer[], game: string, t: Dict): ServerMarker[] {
  return servers.map((s) => {
    const name = s.name || `${s.address}:${s.port}`;
    const code = (s.country_code ?? "").trim().toLowerCase();
    const svg = FLAG_CODES.has(code);
    return {
      id: s.serverId,
      name,
      href: `${basePath}/${game}/servers/${s.serverId}`,
      lat: s.lat,
      lng: s.lng,
      online: s.online,
      flag: svg ? `${basePath}/flags/${code}.svg` : undefined,
      lines: [
        svg ? name : `${flagEmoji(code)} ${name}`.trim(),
        [s.city, s.country_name].filter(Boolean).join(", "),
        `${t.address}: ${s.publicaddress || `${s.address}:${s.port}`}`,
        s.act_map ? `${t.map}: ${s.act_map}` : "",
      ].filter(Boolean),
    };
  });
}
