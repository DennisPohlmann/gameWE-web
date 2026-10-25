import "server-only";
import { ImageResponse } from "next/og";
import { FLAG_CODES } from "@/lib/flag-codes";
import { fmtDuration } from "@/lib/format";
import { imageTheme, parseVoiceBannerFile } from "@/lib/image-theme";
import { statsOrigin } from "@/lib/site-url";
import { getVoiceBox } from "@/lib/voice";
import { flagDataUrl } from "./server-banner";
import { voiceBannerData } from "./voice-banner-data";

// The same frame as the server banner (560x95): side panel and info area.
const W = 560;
const H = 95;
const SIDE = 128;
const INFO = W - 2 - SIDE - 16;
const GAP = 12;
const ADDR = 170;

// TeamSpeak banner, 560x95: file "teamspeak.png" in the banner of the active
// skin, "teamspeak-<template>.png" in that of a design template. Only live
// data from the ServerQuery (kept for a minute in src/lib/voice.ts): name with
// flag, address, status, users online of the slots (big on the left with a
// fill bar), channels, uptime and server type. When the query fails the
// banner says Offline; 404 unless TeamSpeak is the voice server.
export async function voiceBanner(file: string) {
  const f = parseVoiceBannerFile(file);
  const box = f ? await getVoiceBox() : null;
  if (!f || !box?.ts) return new Response("not found", { status: 404 });
  const d = voiceBannerData(box.ts);
  const [th, origin] = await Promise.all([imageTheme(f.style, null), statsOrigin()]);
  const flag = d.country && FLAG_CODES.has(d.country) ? await flagDataUrl(d.country) : null;
  const host = origin.replace(/^https?:\/\//, "");

  const label = { display: "flex", fontSize: 9, fontWeight: 700, color: th.accent, letterSpacing: 0.3 } as const;
  const value = { display: "block", fontSize: 13, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;
  const cell = (l: string, v: React.ReactNode, color?: string, maxWidth = INFO) => (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, maxWidth, overflow: "hidden" }}>
      <div style={label}>{l}</div>
      <div style={{ ...value, maxWidth, color: color ?? th.text }}>{v}</div>
    </div>
  );
  const users = d.clients === null ? "-" : `${d.clients}`;
  const bw = SIDE - 12;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: th.bg, border: `1px solid ${th.frame}`, borderTop: th.stripe ? `3px solid ${th.stripe}` : `1px solid ${th.frame}`, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: SIDE, padding: "4px 6px 6px", background: th.side }}>
          <div style={{ display: "flex", fontSize: 8, fontWeight: 700, color: th.sideText, letterSpacing: 0.3 }}>USERS ONLINE (LIVE)</div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", color: th.sideText }}>
            <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{users}</span>
            <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1, marginLeft: 3, marginBottom: 2, opacity: 0.75 }}>/{d.max ?? "-"}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", width: bw, height: 8, background: th.barBg, border: `1px solid ${th.barBorder}` }}>
              <div style={{ display: "flex", width: Math.round(d.share * (bw - 2)), height: "100%", background: d.online ? th.good : th.bad }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 8, color: th.sideText, marginTop: 2 }}>
              {d.online ? `${Math.round(d.share * 100)}% OF SLOTS` : "NO DATA"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "5px 8px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={label}>TEAMSPEAK SERVER:</div>
            <div style={{ display: "flex", alignItems: "center", width: INFO }}>
              {flag ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={flag} width={16} height={12} style={{ marginRight: 5 }} alt="" />
              ) : null}
              <span style={{ ...value, width: flag ? INFO - 21 : INFO }}>{d.name || d.address}</span>
            </div>
          </div>
          <div style={{ display: "flex", height: 54 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", maxWidth: ADDR, marginRight: GAP }}>
              {cell("ADDRESS:", d.address, undefined, ADDR)}
              {cell("STATUS:", d.online ? "Online" : "Offline", d.online ? th.good : th.bad)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", marginRight: GAP }}>
              {cell("CHANNELS:", d.channels === null ? "-" : String(d.channels))}
              {cell("UPTIME:", d.uptime === null ? "-" : fmtDuration(d.uptime))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, minWidth: 0 }}>
              {cell("SERVER:", d.type)}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ display: "flex", fontSize: 13, fontWeight: 800, color: th.text }}>
                  game<span style={{ color: th.accent }}>WE</span>
                </div>
                <div style={{ display: "flex", fontSize: 8, color: th.muted, maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap" }}>{host}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { "cache-control": "public, max-age=60" } },
  );
}
