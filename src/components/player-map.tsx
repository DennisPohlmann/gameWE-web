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

// OpenStreetMap with one Steam avatar per player at their GeoIP city. Players
// from the same city are spread in a spiral around it so all stay visible.
// style: a key of mapStyles, or "auto" (OpenStreetMap, dark on dark designs).
export function PlayerMap({ markers, style }: { markers: MapMarker[]; style: string }) {
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
      const points: [number, number][] = [];
      for (const m of markers) {
        const key = `${m.lat},${m.lng}`;
        const n = seen.get(key) ?? 0;
        seen.set(key, n + 1);
        // Spiral around the city in screen pixels, so it works at every zoom.
        const r = n ? 17 * Math.sqrt(n) : 0;
        const a = n * 2.4;
        const dx = Math.round(r * Math.cos(a));
        const dy = Math.round(r * Math.sin(a));
        const pos: [number, number] = [m.lat, m.lng];
        points.push(pos);
        const icon = L.divIcon({
          className: "map-avatar",
          html: `<a href="${esc(m.href)}"><img src="${esc(m.avatar)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${esc(m.initial)}'}))"></a>`,
          iconSize: [30, 30],
          iconAnchor: [15 - dx, 15 - dy],
        });
        L.marker(pos, { icon, title: m.name })
          .bindTooltip(
            m.lines
              .map((l, i) => (i ? esc(l) : `<b>${m.flag ? `<span class="flag flag-svg" style="background-image:url('${esc(m.flag)}')"></span>` : ""}${esc(l)}</b>`))
              .join("<br>"), { direction: "top", offset: [dx, dy - 14] })
          .addTo(map);
      }
      if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 6 });
      else map.setView(points[0] ?? [51, 10], points.length ? 6 : 4);
    });
    return () => {
      gone = true;
      map?.remove();
    };
  }, [markers, style]);
  return <div ref={el} className="player-map" />;
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
