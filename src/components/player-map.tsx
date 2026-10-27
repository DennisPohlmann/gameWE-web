"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { mapStyles } from "@/lib/map-styles";
import { vacStateHtml } from "@/lib/server-icons";

export type MapMarker = {
  id: number;
  name: string;
  href: string;
  avatar: string;
  initial: string;
  lat: number;
  lng: number;
  // Flag shown before the name on hover: its position in the sprite (same
  // flags as everywhere).
  flag?: string;
  // Lines shown on hover: name first, then details.
  lines: string[];
  // The server the player is on right now: a line joins them.
  serverId?: number;
  // Drawn faded (an inactive clan member).
  faded?: boolean;
};

// One game server: name (with the flag), page and hover details. vac: the
// VAC state after the name (secured or not, with its title); none when
// unknown.
export type ServerEntry = { id: number; name: string; href: string; online: boolean; flag?: string; vac?: VacInfo; lines: string[] };
export type VacInfo = { secure: boolean; title: string };

// The game servers at one GeoIP location: one hexagon, not an avatar, with
// the number of servers when there are several. online: any of them is.
// title: heading of the hover box when there are several.
export type ServerMarker = { id: number; lat: number; lng: number; online: boolean; place: string; title?: string; servers: ServerEntry[] };

const NO_SERVERS: ServerMarker[] = [];

// Speed of the packet dots on the lines in pixels per second, and the
// shortest run in seconds (very short lines).
const PACKET_SPEED = 40;
const PACKET_MIN_RUN = 1.5;

// Three slim rack units, each with a status light (.led, coloured in CSS).
const SERVER_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
  '<rect x="3.5" y="3" width="17" height="5.2" rx="1.6"/><rect x="3.5" y="9.4" width="17" height="5.2" rx="1.6"/><rect x="3.5" y="15.8" width="17" height="5.2" rx="1.6"/>' +
  '<path class="slot" d="M6.5 5.6h6M6.5 12h6M6.5 18.4h6"/>' +
  '<circle class="led" cx="17" cy="5.6" r="1.35"/><circle class="led" cx="17" cy="12" r="1.35"/><circle class="led" cx="17" cy="18.4" r="1.35"/></svg>';

// The hexagon behind a server marker: a white edge around the dark face
// (both cut out in CSS, see .map-server .hex).
const SERVER_HEX = '<span class="hex" aria-hidden="true"><span></span></span>';

// OpenStreetMap with one Steam avatar per player at their GeoIP city. Players
// from the same city are spread in a spiral around it so all stay visible.
// style: a key of mapStyles, or "auto" (OpenStreetMap, dark on dark designs).
// servers: the ranking's game servers, as hexagons under the players.
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
      // Spiral around the city in screen pixels, so it works at every zoom
      // (points within 0.01°, about 1 km, count as one place). Servers come
      // first and keep the middle: their hexagon takes the first `slots`
      // places, so the players around it leave it and its number visible.
      const spread = (m: { lat: number; lng: number }, slots = 1) => {
        const key = `${m.lat.toFixed(2)},${m.lng.toFixed(2)}`;
        const n = seen.get(key) ?? 0;
        seen.set(key, n + slots);
        const r = n ? 17 * Math.sqrt(n) : 0;
        const a = n * 2.4;
        return [Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a))];
      };
      // Where each server's hexagon is drawn, for the lines to its players.
      const serverAt = new Map<number, { pos: [number, number]; online: boolean }>();
      for (const m of servers) {
        const [dx, dy] = spread(m, 4);
        for (const s of m.servers) serverAt.set(s.id, { pos: [m.lat, m.lng], online: s.online });
        const n = m.servers.length;
        const one = n === 1 ? m.servers[0] : null;
        const icon = L.divIcon({
          className: `map-server${m.online ? " on" : ""}${one ? "" : " group"}${n > 99 ? " many" : ""}${m.servers.some((s) => !s.online) && m.online ? " part" : ""}`,
          // A hexagon a little larger than the player avatars, with a server
          // rack inside; with several servers their number and one status
          // light instead (part: some of them are offline).
          html: one
            ? `<a href="${esc(one.href)}" aria-label="${esc(one.name)}">${SERVER_HEX}${SERVER_ICON}</a>`
            : `<a href="#" role="button" aria-label="${esc(m.title ?? m.place)}">${SERVER_HEX}<i class="led"></i><b>${n}</b></a>`,
          iconSize: [34, 34],
          iconAnchor: [17 - dx, 17 - dy],
        });
        const marker = L.marker([m.lat, m.lng], { icon, zIndexOffset: -1000 })
          .bindTooltip(serverTip(m), { direction: "top", offset: [dx, dy - 16] })
          .addTo(map);
        // Several servers: a click opens a box with a link to each of them.
        if (!one) {
          marker.bindPopup(serverLinks(m), { offset: [dx, dy - 16] });
          marker.on("popupopen", () => marker.closeTooltip());
          marker.getElement()?.querySelector("a")?.addEventListener("click", (e) => e.preventDefault());
        }
      }
      // The view always holds all players and all servers.
      const points: [number, number][] = servers.map((m) => [m.lat, m.lng]);
      const links: { from: [number, number]; dx: number; dy: number; to: [number, number]; online: boolean }[] = [];
      for (const m of markers) {
        const [dx, dy] = spread(m);
        const pos: [number, number] = [m.lat, m.lng];
        points.push(pos);
        const srv = m.serverId === undefined ? undefined : serverAt.get(m.serverId);
        if (srv) links.push({ from: pos, dx, dy, to: srv.pos, online: srv.online });
        const icon = L.divIcon({
          className: m.faded ? "map-avatar faded" : "map-avatar",
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
      if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 6 });
      else map.setView(points[0] ?? [51, 10], points.length ? 6 : 4);
      // A thin line from each player to their server, along the great circle,
      // under the markers and not clickable. It starts at the player's picture
      // (which may sit beside its city, see spread), so it is drawn again
      // after each zoom. On a line to an online server a dot (a "packet")
      // runs to and fro along the line's own SVG path (CSS offset-path,
      // see .map-packet), so it needs no script loop; noClip keeps that path
      // in one piece.
      if (links.length) {
        const lines = links.map((k) =>
          L.polyline([], { className: `map-link${k.online ? " on" : ""}`, interactive: false, weight: 1.5, noClip: true }).addTo(map!),
        );
        const packets = links.map((k, i) => {
          const path = lines[i].getElement();
          if (!k.online || !path?.parentNode) return null;
          const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          dot.setAttribute("class", "map-packet");
          dot.setAttribute("r", "2.5");
          path.parentNode.appendChild(dot);
          return dot;
        });
        // The dots follow the path as Leaflet draws it (after zooms and moves)
        // at the same slow speed on every line: one run takes the line's
        // length on screen divided by PACKET_SPEED. Each dot starts at another
        // point of its run.
        const follow = () => {
          packets.forEach((dot, i) => {
            const path = lines[i].getElement() as SVGPathElement | undefined;
            const d = path?.getAttribute("d");
            if (!dot || !path || !d) return;
            const run = Math.max(path.getTotalLength() / PACKET_SPEED, PACKET_MIN_RUN);
            dot.style.offsetPath = `path("${d}")`;
            dot.style.animationDuration = `${run.toFixed(2)}s`;
            dot.style.animationDelay = `-${(((i * 0.37) % 1) * run).toFixed(2)}s`;
          });
        };
        const draw = () => {
          links.forEach((k, i) => {
            const path: import("leaflet").LatLngExpression[] = greatCircle(k.from, k.to);
            path[0] = map!.layerPointToLatLng(map!.latLngToLayerPoint(k.from).add([k.dx, k.dy]));
            lines[i].setLatLngs(path);
          });
          follow();
        };
        draw();
        map.on("zoomend", draw);
        map.getRenderer(lines[0]).on("update", follow);
      }
    });
    return () => {
      gone = true;
      map?.remove();
    };
  }, [markers, servers, style]);
  return <div ref={el} className="player-map" />;
}

// Points along the great circle from a to b (as a straight line when they
// are close), with longitudes kept continuous so the line does not jump
// across the date line.
function greatCircle(a: [number, number], b: [number, number]): [number, number][] {
  const rad = Math.PI / 180;
  const [p1, l1, p2, l2] = [a[0] * rad, a[1] * rad, b[0] * rad, b[1] * rad];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (d < 0.02) return [a, b];
  const out: [number, number][] = [];
  const n = 32;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    let lng = Math.atan2(y, x) / rad;
    const prev = out[i - 1];
    if (prev) while (lng - prev[1] > 180) lng -= 360;
    if (prev) while (lng - prev[1] < -180) lng += 360;
    out.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / rad, lng]);
  }
  return out;
}

// Hover box: first line bold with the flag (and a server's VAC shield),
// then the details.
function tip(m: { lines: string[]; flag?: string; vac?: VacInfo }) {
  return m.lines
    .map((l, i) => (i ? esc(l) : `<b>${m.flag ? `<span class="flag flag-svg" style="background-position:${esc(m.flag)}"></span>` : ""}${esc(l)}</b>${vacMark(m.vac)}`))
    .join("<br>");
}

// The VAC state of the server lists, with its title.
function vacMark(vac?: VacInfo) {
  return vac ? ` <span class="vac-mark ${vac.secure ? "vac-secure" : "vac-insecure"}" title="${esc(vac.title)}" role="img" aria-label="${esc(vac.title)}">${vacStateHtml(vac.secure)}</span>` : "";
}

// Hover box of a server marker: one server as a player's (name, place,
// details); several under the place, each with its status light.
function serverTip(m: ServerMarker) {
  if (m.servers.length === 1) {
    const s = m.servers[0];
    return tip({ flag: s.flag, vac: s.vac, lines: [s.name, m.place, ...s.lines].filter(Boolean) });
  }
  return (
    `<b>${esc(m.title ?? m.place)}</b>` +
    m.servers
      .map(
        (s) =>
          `<div class="srv-row"><i class="srv-dot${s.online ? " on" : ""}"></i><b>${s.flag ? `<span class="flag flag-svg" style="background-position:${esc(s.flag)}"></span>` : ""}${esc(s.name)}</b>${vacMark(s.vac)}<br>${s.lines.map(esc).join(" · ")}</div>`,
      )
      .join("")
  );
}

// Click box of a marker with several servers: a link to each server page.
function serverLinks(m: ServerMarker) {
  return (
    `<b>${esc(m.title ?? m.place)}</b><ul class="srv-list">` +
    m.servers.map((s) => `<li><i class="srv-dot${s.online ? " on" : ""}"></i><a href="${esc(s.href)}">${esc(s.name)}</a></li>`).join("") +
    "</ul>"
  );
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
