import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getPlayer, getPlayerPosition, getRankedCount } from "@/lib/data";
import { getRanks, rankFor } from "@/lib/awards";
import { RankBadge, rankName } from "@/components/badges";
import { getSettings } from "@/lib/settings";
import { statsOrigin } from "@/lib/site-url";
import { getSteamProfile } from "@/lib/steam";
import { FLAG_CODES } from "@/lib/flag-codes";
import { activity, kpd, ratio, steamIds } from "@/lib/format";
import { CLASSIC_STYLE, imageTheme, parseImageFile } from "@/lib/image-theme";

// Forum signature: /sig/<playerId>.png, 400x100, in the classic grey look;
// /sig/<playerId>-<template>.png in a design template's colours. Left the rank insignia and the progress to the next rank,
// right avatar, position and key numbers.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const f = parseImageFile((await params).file);
  const p = f ? await getPlayer(f.id) : undefined;
  if (!p) return new Response("not found", { status: 404 });
  const ids = steamIds(p.uniqueId);
  const [position, total, ranks, settings, origin, steam] = await Promise.all([
    p.hideranking ? Promise.resolve(null) : getPlayerPosition(p.game, p.skill),
    getRankedCount(p.game),
    getRanks(p.game),
    getSettings(),
    statsOrigin(),
    ids ? getSteamProfile(ids.steam64) : Promise.resolve(null),
  ]);
  const th = await imageTheme(f?.style ?? CLASSIC_STYLE);
  const rank = rankFor(p.kills, ranks);
  const progress = rank ? (rank.next !== null ? (p.kills - rank.minimum) / (rank.next - rank.minimum) : 1) : 0;
  const act = activity(p.last_event, settings.activityDays);
  const num = (n: number) => Math.round(n).toLocaleString("en-US");
  const t = p.connection_time;
  const online = `${Math.floor(t / 86400)}d ${String(Math.floor((t % 86400) / 3600)).padStart(2, "0")}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}h`;
  const host = origin.replace(/^https?:\/\//, "");
  const cc = (p.flag ?? "").trim().toLowerCase();
  const [avatar, flag] = await Promise.all([
    steam?.avatar ? toDataUrl(steam.avatar) : Promise.resolve(null),
    // The site's own SVG flag; the letter code stays as fallback.
    FLAG_CODES.has(cc) ? flagDataUrl(cc) : Promise.resolve(null),
  ]);
  const bar = (v: number, w: number, label: string, fill = "linear-gradient(180deg, #ffd27a, #e8a317)") => (
    <div style={{ display: "flex", position: "relative", width: w, height: 12, background: th.barBg, border: `1px solid ${th.barBorder}` }}>
      <div style={{ display: "flex", width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`, height: "100%", background: fill }} />
      <div style={{ display: "flex", position: "absolute", left: 0, top: -1, width: "100%", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", textShadow: "0 0 2px #000, 0 0 1px #000, 0 0 1px #000" }}>{label}</div>
    </div>
  );
  const line = { display: "flex", fontSize: 11, color: th.text, height: 15, alignItems: "center" } as const;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: th.bg, border: `1px solid ${th.frame}`, borderTop: th.stripe ? `3px solid ${th.stripe}` : `1px solid ${th.frame}`, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", width: 78, padding: "8px 6px 8px", background: th.side }}>
          {rank ? <RankBadge name={rank.name} size={56} plain /> : <div style={{ display: "flex", width: 56, height: 56 }} />}
          {bar(progress, 64, `${Math.floor(progress * 100)}%`)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "6px 8px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} width={32} height={32} style={{ border: "1px solid #777", marginRight: 6 }} alt="" />
            ) : (
              <div style={{ display: "flex", width: 32, height: 32, marginRight: 6, background: "#555", border: "1px solid #777", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 16, fontWeight: 700 }}>
                {(p.name ?? "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "?"}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                {flag ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={flag} width={16} height={12} style={{ objectFit: "contain", marginRight: 4 }} alt="" />
                ) : cc ? (
                  <span style={{ fontSize: 8, fontWeight: 700, color: "#111", background: "#ddd", padding: "0 2px", marginRight: 4, borderRadius: 2 }}>{cc.toUpperCase()}</span>
                ) : null}
                <span style={{ fontSize: 13, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", maxWidth: 240 }}>{p.name ?? `#${p.playerId}`}</span>
              </div>
              <div style={line}>
                {position ? (
                  <>
                    Position&nbsp;<b style={{ color: th.accent }}>{num(position)}</b>&nbsp;of {num(total)} Players with {num(p.skill)} Points
                  </>
                ) : (
                  <>{num(p.skill)} Points{rank ? ` · ${rankName(rank.name)}` : ""}</>
                )}
              </div>
            </div>
          </div>
          <div style={{ ...line, marginTop: 3 }}>
            {num(p.kills)} Kills, {num(p.deaths)} Deaths ({kpd(p.kills, p.deaths).toFixed(2)}), {num(p.headshots)} HS ({Math.round((ratio(p.headshots, p.kills) ?? 0) * 100)}%)
          </div>
          <div style={{ ...line, marginTop: 2 }}>
            <span style={{ width: 52 }}>Activity:</span>
            {bar(act / 100, 70, `${act}%`, activityFill(act / 100))}
            <span style={{ marginLeft: 10 }}>Time: {online}</span>
          </div>
          <div style={{ ...line, marginTop: 2, color: th.muted }}>Statistics: {host}</div>
          <div style={{ display: "flex", position: "absolute", right: 6, bottom: 4, maxWidth: 120, overflow: "hidden", whiteSpace: "nowrap", fontSize: 10, fontWeight: 700, color: th.accent }}>
            {settings.sigBrand}
          </div>
        </div>
      </div>
    ),
    { width: 400, height: 100, headers: { "cache-control": "public, max-age=900" } },
  );
}

// Avatar and flag are embedded so the image renders even if Steam or the flag
// server is slow later.
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\/(jpeg|png|gif|webp)/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

// Activity colour as on the site: red at 0 %, through yellow, to green.
function activityFill(v: number) {
  const h = 120 * Math.max(0, Math.min(1, v));
  const [r, g, b] = hsl(h, 0.8, 0.45);
  const [r2, g2, b2] = hsl(h, 0.8, 0.6);
  return `linear-gradient(180deg, rgb(${r2},${g2},${b2}), rgb(${r},${g},${b}))`;
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return [f(0), f(8), f(4)];
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
