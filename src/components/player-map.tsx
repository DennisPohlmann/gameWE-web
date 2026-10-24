"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { mapStyles } from "@/lib/map-styles";

export type MapMarker = {
  id: number;
  name: string;
  href: string;
  avatar: string;
  initial: string;
  lat: number;
  lng: number;
  // SVG flag shown before the name on hover (same flags as everywhere).
  flag?: string;
  // Lines shown on hover: name first, then details.
  lines: string[];
};

// A game server at its GeoIP location: drawn as a square, not an avatar.
export type ServerMarker = Omit<MapMarker, "avatar" | "initial">;

const NO_SERVERS: ServerMarker[] = [];

// Two rack units with a status light and a slot each, drawn in currentColor.
const SERVER_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
  '<rect x="3" y="3.5" width="18" height="7" rx="2"/><rect x="3" y="13.5" width="18" height="7" rx="2"/>' +
  '<path d="M12 7h5M12 17h5"/><circle cx="7" cy="7" r="1" fill="currentColor"/><circle cx="7" cy="17" r="1" fill="currentColor"/></svg>';

// OpenStreetMap with one Steam avatar per player at their GeoIP city. Players
// from the same city are spread in a spiral around it so all stay visible.
// style: a key of mapStyles, or "auto" (OpenStreetMap, dark on dark designs).
// servers: the ranking's game servers, as squares under the players.
export function PlayerMap({ markers, servers = NO_SERVERS, style }: { markers: MapMarker[]; servers?: ServerMarker[]; style: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let gone = false;
    import("leaflet").then((L) => {
      if (gone || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false, worldCopyJump: true });
      const tiles = mapStyles[style] ?? mapStyles[darkPage(el.current) ? "osm-dark" : "osm"];
      el.current.classList.toggle("map-dark", !!tiles.dark);
      L.tileLayer(tiles.url, { maxZoom: tiles.maxZoom, attribution: tiles.attribution, subdomains: tiles.subdomains ?? "abc" }).addTo(map);
      const seen = new Map<string, number>();
      // Spiral around the city in screen pixels, so it works at every zoom.
      // Servers come first, so they keep the middle of their city.
      const spread = (m: { lat: number; lng: number }) => {
        const key = `${m.lat},${m.lng}`;
        const n = seen.get(key) ?? 0;
        seen.set(key, n + 1);
        const r = n ? 17 * Math.sqrt(n) : 0;
        const a = n * 2.4;
        return [Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a))];
      };
      for (const m of servers) {
        const [dx, dy] = spread(m);
        const icon = L.divIcon({
          className: "map-server",
          // Same size as the player avatars, with a server rack inside.
          html: `<a href="${esc(m.href)}" aria-label="${esc(m.name)}">${SERVER_ICON}</a>`,
          iconSize: [30, 30],
          iconAnchor: [15 - dx, 15 - dy],
        });
        L.marker([m.lat, m.lng], { icon, zIndexOffset: -1000 })
          .bindTooltip(tip(m), { direction: "top", offset: [dx, dy - 14] })
          .addTo(map);
      }
      const points: [number, number][] = [];
      for (const m of markers) {
        const [dx, dy] = spread(m);
        const pos: [number, number] = [m.lat, m.lng];
        points.push(pos);
        const icon = L.divIcon({
          className: "map-avatar",
          // The initial shows until the avatar has loaded, then the avatar fades
          // in over it; if it does not load, the initial stays.
          html: `<a href="${esc(m.href)}" aria-label="${esc(m.name)}"><span>${esc(m.initial)}</span><img src="${esc(m.avatar)}" alt="" loading="lazy" onload="this.classList.add('ok')" onerror="this.remove()"></a>`,
          iconSize: [30, 30],
          iconAnchor: [15 - dx, 15 - dy],
        });
        // No title: the browser's own tooltip would repeat the name under ours.
        L.marker(pos, { icon })
          .bindTooltip(tip(m), { direction: "top", offset: [dx, dy - 14] })
          .addTo(map);
      }
      // Without players, the map shows where the servers are.
      if (!points.length) for (const m of servers) points.push([m.lat, m.lng]);
      if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 6 });
      else map.setView(points[0] ?? [51, 10], points.length ? 6 : 4);
    });
    return () => {
      gone = true;
      map?.remove();
    };
  }, [markers, servers, style]);
  return <div ref={el} className="player-map" />;
}

// Hover box: first line bold with the flag, then the details.
function tip(m: { lines: string[]; flag?: string }) {
  return m.lines
    .map((l, i) => (i ? esc(l) : `<b>${m.flag ? `<span class="flag flag-svg" style="background-image:url('${esc(m.flag)}')"></span>` : ""}${esc(l)}</b>`))
    .join("<br>");
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Whether the design behind the map is dark: the first non-transparent
// background up the tree, by its brightness.
function darkPage(from: HTMLElement): boolean {
  for (let n: HTMLElement | null = from.parentElement; n; n = n.parentElement) {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(n).backgroundColor);
    if (!m || m[4] === "0") continue;
    return 0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3] < 110;
  }
  return false;
}
