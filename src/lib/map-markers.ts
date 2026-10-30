import "server-only";
import type { MapMarker, ServerEntry, ServerMarker } from "@/components/player-map";
import { basePath } from "./base-path";
import type { MapPlayer, MapServer } from "./data";
import { FLAG_CODES, flagPos } from "./flag-codes";
import { flagEmoji, fmtDate, fmtDuration, fmtNum, kpd } from "./format";
import type { Dict, Lang } from "./i18n";

// Markers for the player map: avatar, link and the hover lines per player.
// inactive: a member the collector moved out of the ranking (clan map), drawn
// faded and named so on hover.
export function mapMarkers(players: (MapPlayer & { server?: string | null; serverId?: number; inactive?: boolean })[], game: string, t: Dict, lang: Lang): MapMarker[] {
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
      serverId: p.serverId,
      faded: p.inactive || undefined,
      flag: svg ? flagPos(code) : undefined,
      lines: [
        svg ? name : `${flagEmoji(p.flag)} ${name}`.trim(),
        [p.city, p.country].filter(Boolean).join(", "),
        `${p.rank ? `${t.rank}: ${fmtNum(p.rank, lang)} · ` : ""}${t.points}: ${fmtNum(p.skill, lang)} · ${t.kills}: ${fmtNum(p.kills, lang)} · ${t.kpd}: ${kpd(p.kills, p.deaths).toFixed(2)}`,
        p.server ? `${t.server}: ${p.server}` : `${t.lastConnect}: ${fmtDate(p.last_event, lang)}`,
        p.inactive ? t.inactiveMember : "",
      ].filter(Boolean),
    };
  });
}

// Markers for the game servers on the player map, one per place: servers at
// the same point (coordinates rounded to 0.01°, about 1 km) share a marker.
// Each server gets a link to its page and its hover details (address as in
// the server list, map, uptime as on the server page). icon: the game's icon
// before each server name (gameIconSrc of the ranking's game).
export function serverMarkers(servers: MapServer[], game: string, t: Dict, icon?: string | null): ServerMarker[] {
  const groups = new Map<string, ServerMarker>();
  for (const s of servers) {
    const name = s.name || `${s.address}:${s.port}`;
    const code = (s.country_code ?? "").trim().toLowerCase();
    const svg = FLAG_CODES.has(code);
    const entry: ServerEntry = {
      name: svg ? name : `${flagEmoji(code)} ${name}`.trim(),
      id: s.serverId,
      href: `${basePath}/${game}/servers/${s.serverId}`,
      online: s.online,
      icon: icon ?? undefined,
      flag: svg ? flagPos(code) : undefined,
      vac: s.server_vac === "secure" ? { secure: true, title: t.vacSecure } : s.server_vac === "insecure" ? { secure: false, title: t.vacInsecure } : undefined,
      lines: [
        `${t.address}: ${s.publicaddress || `${s.address}:${s.port}`}`,
        s.act_map ? `${t.map}: ${s.act_map}` : "",
        // Offline servers have no uptime.
        s.uptime ? `${t.uptime}: ${fmtDuration(s.uptime * 60)}` : "",
      ].filter(Boolean),
    };
    const key = `${s.lat.toFixed(2)},${s.lng.toFixed(2)}`;
    const g = groups.get(key);
    if (g) {
      g.servers.push(entry);
      g.online ||= s.online;
    } else {
      groups.set(key, {
        id: s.serverId,
        lat: s.lat,
        lng: s.lng,
        online: s.online,
        place: [s.city, s.country_name].filter(Boolean).join(", "),
        servers: [entry],
      });
    }
  }
  for (const g of groups.values()) {
    if (g.servers.length > 1) g.title = [g.place, `${g.servers.length} ${t.servers}`].filter(Boolean).join(" · ");
  }
  return [...groups.values()];
}
