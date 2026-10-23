import "server-only";
import type { MapMarker } from "@/components/player-map";
import { basePath } from "./base-path";
import type { MapPlayer } from "./data";
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
        `${t.points}: ${fmtNum(p.skill, lang)} · ${t.kills}: ${fmtNum(p.kills, lang)} · ${t.kpd}: ${kpd(p.kills, p.deaths).toFixed(2)}`,
        p.server ? `${t.server}: ${p.server}` : `${t.lastConnect}: ${fmtDate(p.last_event, lang)}`,
      ].filter(Boolean),
    };
  });
}
