import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getGame, getServer, getServerLoad, getServerRank } from "@/lib/data";
import { statsOrigin } from "@/lib/site-url";
import { FLAG_CODES } from "@/lib/flag-codes";
import { nowUnix } from "@/lib/format";
import { CLASSIC_STYLE, imageTheme, parseImageFile } from "@/lib/image-theme";

const W = 560;
const H = 95;

// Server banner: /banner/<serverId>.png, 560x95, in the classic grey look;
// /banner/<serverId>-<template>.png in a design template's colours. Name with flag, address, port, status, players with a pie,
// rank, map and, on the left, the players of the last 24 hours.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const f = parseImageFile((await params).file);
  const s = f ? await getServer(f.id) : undefined;
  if (!s) return new Response("not found", { status: 404 });
  const now = nowUnix();
  const [game, load, rank, origin] = await Promise.all([getGame(s.game), getServerLoad(s.serverId, now - 86400), getServerRank(Number(s.kills)), statsOrigin()]);
  if (!game) return new Response("not found", { status: 404 });
  const th = await imageTheme(f?.style ?? CLASSIC_STYLE);
  const cc = (s.country_code ?? "").trim().toLowerCase();
  const flag = FLAG_CODES.has(cc) ? await flagDataUrl(cc) : null;
  const addr = s.publicaddress || `${s.address}:${s.port}`;
  const cut = addr.lastIndexOf(":");
  const ip = cut > 0 ? addr.slice(0, cut) : addr;
  const port = cut > 0 ? addr.slice(cut + 1) : String(s.port);
  // Online while the collector keeps writing load samples (every 10 minutes).
  const online = load.length > 0 && load[load.length - 1].timestamp >= now - 1800;
  const act = Number(s.act_players) || 0;
  const max = Number(s.max_players) || 0;
  const host = origin.replace(/^https?:\/\//, "");

  const label = { display: "flex", fontSize: 9, fontWeight: 700, color: th.accent, letterSpacing: 0.3 } as const;
  const value = { display: "block", fontSize: 13, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;
  const cell = (w: number, l: string, v: React.ReactNode, color?: string) => (
    <div style={{ display: "flex", flexDirection: "column", width: w, overflow: "hidden" }}>
      <div style={label}>{l}</div>
      <div style={{ ...value, width: w - 6, color: color ?? th.text }}>{v}</div>
    </div>
  );

  // Pie: share of the slots in use.
  const share = max ? Math.min(1, act / max) : 0;
  const r = 9;
  const circ = 2 * Math.PI * r;
  const pie = (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill={th.barBg} stroke={th.barBorder} strokeWidth="1" />
      <circle cx="12" cy="12" r={r / 2} fill="none" stroke={th.good} strokeWidth={r} strokeDasharray={`${(share * circ) / 2} ${circ}`} transform="rotate(-90 12 12)" />
    </svg>
  );

  // Players of the last 24 hours.
  // The graph with a small scale on its left: at most four steps of 1, 2,
  // 5, 10, 20, 25, 50 or 100 players.
  const cw = 78;
  const ch = 58;
  const peak = Math.max(1, max, ...load.map((l) => l.act_players));
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((n) => peak / n <= 4) ?? Math.ceil(peak / 400) * 100;
  const top = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const pts = load.map((l) => `${(((l.timestamp - (now - 86400)) / 86400) * cw).toFixed(1)},${(ch - (l.act_players / top) * ch).toFixed(1)}`).join(" ");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: th.bg, border: `1px solid ${th.frame}`, borderTop: th.stripe ? `3px solid ${th.stripe}` : `1px solid ${th.frame}`, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 112, padding: "5px 8px", background: th.side }}>
          <div style={{ display: "flex", fontSize: 8, fontWeight: 700, color: th.sideText, letterSpacing: 0.3 }}># OF PLAYERS (24 H)</div>
          <div style={{ display: "flex", marginTop: 4 }}>
            <div style={{ display: "flex", position: "relative", width: 18, height: ch }}>
              {ticks.map((v) => (
                <div key={v} style={{ display: "flex", position: "absolute", right: 3, top: Math.min(ch - 9, Math.max(0, ch - (v / top) * ch - 5)), fontSize: 8, lineHeight: 1, color: th.sideText }}>
                  {v}
                </div>
              ))}
            </div>
            <svg width={cw} height={ch} viewBox={`0 0 ${cw} ${ch}`}>
              <rect x="0" y="0" width={cw} height={ch} fill={th.barBg} stroke={th.barBorder} strokeWidth="1" />
              {ticks.slice(1, -1).map((v) => (
                <line key={v} x1="0" x2={cw} y1={ch - (v / top) * ch} y2={ch - (v / top) * ch} stroke={th.barBorder} strokeWidth="0.6" strokeDasharray="2 2" />
              ))}
              {load.length > 1 ? <polyline points={pts} fill="none" stroke={th.accent} strokeWidth="1.5" /> : null}
            </svg>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "5px 8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={label}>SERVER NAME:</div>
              <div style={{ display: "flex", alignItems: "center", width: 330 }}>
                {flag ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={flag} width={16} height={12} style={{ marginRight: 5 }} alt="" />
                ) : null}
                <span style={{ ...value, width: flag ? 309 : 330 }}>{s.name || addr}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: 96 }}>
              <div style={{ display: "flex", fontSize: 13, fontWeight: 800, color: th.text }}>
                game<span style={{ color: th.accent }}>WE</span>
              </div>
              <div style={{ display: "flex", fontSize: 8, color: th.muted, maxWidth: 96, overflow: "hidden", whiteSpace: "nowrap" }}>{host}</div>
            </div>
          </div>
          <div style={{ display: "flex" }}>
            {cell(196, "IP ADDRESS:", ip)}
            {cell(54, "PORT:", port)}
            {cell(180, "STATUS:", online ? "Online" : "Offline", online ? th.good : th.bad)}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", width: 196 }}>
              {pie}
              <div style={{ display: "flex", marginLeft: 5 }}>{cell(120, "PLAYERS:", `${act}/${max}`)}</div>
            </div>
            {cell(54, "RANK:", ordinal(rank))}
            {cell(180, "CURRENT MAP:", s.act_map || "-")}
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { "cache-control": "public, max-age=300" } },
  );
}

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}

// Flag from public/flags as a data URL (cc is checked against FLAG_CODES).
async function flagDataUrl(cc: string): Promise<string | null> {
  try {
    const svg = await readFile(path.join(process.cwd(), "public", "flags", `${cc}.svg`));
    return `data:image/svg+xml;base64,${svg.toString("base64")}`;
  } catch {
    return null;
  }
}
