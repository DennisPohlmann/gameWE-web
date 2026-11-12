import "server-only";
import { cachedBanner } from "./cache";
import { bannerFonts } from "./fonts";
import { Backdrop } from "./backdrop";
import { onColor } from "./wide-banner";
import { imageLang, optionsKey, type BannerOptions } from "./options";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getGame, getPlayer, getPlayerHistory, getPlayerPosition, getPlayerSkillBefore, getRankedCount, noProfile } from "@/lib/data";
import { pointsTrend } from "@/lib/points-trend";
import { siteDay } from "@/lib/day";
import { getRanks, rankFor } from "@/lib/awards";
import { RankBadge, rankName } from "@/components/badges";
import { getSettings } from "@/lib/settings";
import { statsOrigin } from "@/lib/site-url";
import { getSteamProfile } from "@/lib/steam";
import { FLAG_CODES } from "@/lib/flag-codes";
import { steamAvatarUrl } from "@/lib/steam-avatar";
import { activity, fmtDuration, fmtNum, kpd, ratio, steamIds } from "@/lib/format";
import { imageTheme, parseImageFile, type ImageTheme } from "@/lib/image-theme";
import { dicts } from "@/translations";
import { SPARK_H, SPARK_W, sparkPaths } from "@/lib/sparkline";

// Player banner (forum signature), 400x100: file "<playerId>.png" in the
// banner of the active skin, "<playerId>-<template>.png" in that of a design
// template; o the layout (a to d), background pattern and language of the
// texts (lib/banners/options.ts). Same rules as the profile: 404 for a hidden ranking and for
// bots while they have no profile; hidden players keep it, without their
// position. With game set (banner/<game>/player/...) the player must belong
// to that ranking; null only for the old /sig/<file>.
export function playerBanner(file: string, game: string | null, o: BannerOptions) {
  return cachedBanner(`player|${game ?? ""}|${optionsKey(o)}`, file, () => render(file, game, o));
}

// Layout D: the points of the last TREND_DAYS days.
const TREND_DAYS = 30;


async function render(file: string, game: string | null, o: BannerOptions) {
  const f = parseImageFile(file);
  const p = f ? await getPlayer(f.id) : undefined;
  const g = p && (game === null || p.game === game) && !(await noProfile(p)) ? await getGame(p.game) : undefined;
  if (!p || !g) return new Response("not found", { status: 404 });
  const ids = steamIds(p.uniqueId);
  const trend = o.layout === "d";
  const [position, total, ranks, settings, origin, steam, fonts, history, before] = await Promise.all([
    p.hideranking || p.inactive ? Promise.resolve(null) : getPlayerPosition(p),
    getRankedCount(p.game),
    getRanks(p.game),
    getSettings(),
    statsOrigin(),
    ids ? getSteamProfile(ids.steam64) : Promise.resolve(null),
    bannerFonts(),
    trend ? getPlayerHistory(p.playerId, TREND_DAYS) : Promise.resolve([]),
    trend ? getPlayerSkillBefore(p.playerId, TREND_DAYS) : Promise.resolve(null),
  ]);
  const th = await imageTheme(f?.style ?? null, g);
  const rank = rankFor(Number(p.careerKills), ranks);
  const cc = (p.flag ?? "").trim().toLowerCase();
  const [avatar, flag] = await Promise.all([
    steam?.avatar ? toDataUrl(steam.avatar) : Promise.resolve(null),
    // The site's own SVG flag; the letter code stays as fallback.
    FLAG_CODES.has(cc) ? flagDataUrl(cc) : Promise.resolve(null),
  ]);
  const lang = imageLang(o.lang);
  const days = trend ? pointsTrend(history.map((h) => ({ day: String(h.eventTime).slice(0, 10), skill: Number(h.skill), change: Number(h.skill_change) })), before, siteDay()) : [];
  const d: Data = {
    th,
    t: dicts[lang],
    n: (v: number, digits = 0) => fmtNum(v, lang, digits),
    name: p.name ?? `#${p.playerId}`,
    initial: (p.name ?? "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "?",
    cc,
    flag,
    avatar,
    rank: rank ? { name: rank.name, title: rankName(rank.name), progress: rank.next !== null ? (p.kills - rank.minimum) / (rank.next - rank.minimum) : 1 } : null,
    position,
    total,
    points: p.skill,
    kills: p.kills,
    deaths: p.deaths,
    kpd: kpd(p.kills, p.deaths),
    hs: p.headshots,
    hsPct: ratio(p.headshots, p.kills) ?? 0,
    act: activity(p.last_event, settings.activityDays),
    time: p.connection_time,
    host: origin.replace(/^https?:\/\//, ""),
    brand: settings.sigBrand,
    trend: days.map((x) => x.points),
    change: days.reduce((sum, x) => sum + x.change, 0),
  };
  const draw = { a: drawA, b: drawB, c: drawC, d: drawD }[o.layout] ?? drawA;
  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: th.bg }}>
      <Backdrop bg={o.bg} th={th} />
      {draw(d)}
    </div>,
    { width: 400, height: 100, fonts, headers: { "cache-control": "public, max-age=900" } },
  );
}

type Data = {
  th: ImageTheme;
  t: (typeof dicts)["en"];
  n: (v: number, digits?: number) => string;
  name: string;
  initial: string;
  cc: string;
  flag: string | null;
  avatar: string | null;
  rank: { name: string; title: string; progress: number } | null;
  position: number | null;
  total: number;
  points: number;
  kills: number;
  deaths: number;
  kpd: number;
  hs: number;
  hsPct: number;
  act: number;
  time: number;
  host: string;
  brand: string;
  // Points per day, oldest first, and their change over the days (layout D only).
  trend: number[];
  change: number;
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const pct = (v: number) => `${Math.round(clamp(v) * 100)}%`;

function Flag({ d, h = 11 }: { d: Data; h?: number }) {
  if (d.flag) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={d.flag} width={Math.round((h * 4) / 3)} height={h} style={{ objectFit: "contain", marginRight: 5, borderRadius: 1 }} alt="" />;
  }
  return d.cc ? <span style={{ fontSize: 8, fontWeight: 700, color: "#111", background: "#ddd", padding: "0 2px", marginRight: 5, borderRadius: 2 }}>{d.cc.toUpperCase()}</span> : null;
}

function Avatar({ d, size, radius = 3 }: { d: Data; size: number; radius?: number }) {
  if (d.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={d.avatar} width={size} height={size} style={{ borderRadius: radius, border: `1px solid ${d.th.border}` }} alt="" />;
  }
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: radius, background: d.th.barBg, border: `1px solid ${d.th.border}`, alignItems: "center", justifyContent: "center", color: d.th.muted, fontSize: Math.round(size / 2), fontWeight: 700 }}>
      {d.initial}
    </div>
  );
}

// A thin bar without text (the value stands next to it).
function Meter({ v, w, h = 4, fill, d }: { v: number; w: number; h?: number; fill: string; d: Data }) {
  return (
    <div style={{ display: "flex", width: w, height: h, borderRadius: h, background: d.th.barBg, overflow: "hidden" }}>
      <div style={{ display: "flex", width: pct(v), height: "100%", borderRadius: h, background: fill }} />
    </div>
  );
}

function positionText(d: Data) {
  return d.position ? `#${d.n(d.position)}` : "–";
}

// A row of values left of the site address in a strip h px high: whatever
// does not fit wraps into the hidden second line and drops out whole,
// so values never overlap and the address never wraps.
function Fits({ h, children }: { h: number; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", flex: 1, minWidth: 0, height: h, overflow: "hidden" }}>{children}</div>;
}

function Host({ d, gap = 8 }: { d: Data; gap?: number }) {
  return <span style={{ display: "flex", flexShrink: 0, marginLeft: gap, whiteSpace: "nowrap" }}>{d.host}</span>;
}

// A: "Klar" – Inter, side panel with insignia, stat cells with labels.
function drawA(d: Data) {
  const { th, t } = d;
  const cell = (value: string, label: string, color = th.text) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ display: "flex", fontSize: 14, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ display: "flex", fontSize: 8, color: th.muted, textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 1.2 }}>{label}</div>
    </div>
  );
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", border: `1px solid ${th.frame}`, borderTop: th.stripe ? `3px solid ${th.stripe}` : `1px solid ${th.frame}`, fontFamily: "Inter" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 80, padding: "0 7px", background: th.side, borderRight: `1px solid ${th.border}` }}>
        {d.rank ? <RankBadge name={d.rank.name} size={46} plain /> : <div style={{ display: "flex", width: 46, height: 46 }} />}
        <div style={{ display: "flex", fontSize: 8, color: th.sideText, marginTop: 2, maxWidth: 66, overflow: "hidden", whiteSpace: "nowrap", justifyContent: "center" }}>{d.rank?.title ?? ""}</div>
        {d.rank ? (
          <div style={{ display: "flex", alignItems: "center", marginTop: 3 }}>
            <Meter v={d.rank.progress} w={44} fill={th.accent} d={d} />
            <span style={{ fontSize: 8, color: th.sideText, marginLeft: 4 }}>{pct(d.rank.progress)}</span>
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "6px 9px 5px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Avatar d={d} size={30} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 7, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Flag d={d} />
              <span style={{ fontSize: 14, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190 }}>{d.name}</span>
            </div>
            <div style={{ display: "flex", fontSize: 9, color: th.muted, marginTop: 1 }}>
              {d.position ? `${t.positionOf.replace("{n}", d.n(d.total))} · ` : ""}
              {d.n(d.points)} {t.points}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginLeft: 6 }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: th.accent, lineHeight: 1 }}>{positionText(d)}</div>
            <div style={{ display: "flex", fontSize: 8, fontWeight: 700, color: th.muted, marginTop: 2, maxWidth: 110, overflow: "hidden", whiteSpace: "nowrap" }}>{d.brand}</div>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 6 }}>
          {cell(d.n(d.kills), t.kills)}
          {cell(d.n(d.deaths), t.deaths)}
          {cell(d.n(d.kpd, 2), t.kpd, d.kpd >= 1 ? th.good : th.bad)}
          {cell(`${Math.round(d.hsPct * 100)}%`, t.hs)}
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 5, fontSize: 9, color: th.muted }}>
          <Fits h={12}>
            <span style={{ display: "flex", alignItems: "center", height: 12, marginRight: 9, whiteSpace: "nowrap" }}>
              <span style={{ marginRight: 4 }}>{t.activity}</span>
              <Meter v={d.act / 100} w={28} fill={activityColor(d.act / 100)} d={d} />
              <span style={{ marginLeft: 4, color: th.text }}>{d.act}%</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", height: 12, whiteSpace: "nowrap" }}>
              <span style={{ marginRight: 4 }}>{t.playTime}</span>
              <span style={{ color: th.text }}>{fmtDuration(d.time)}</span>
            </span>
          </Fits>
          <Host d={d} />
        </div>
      </div>
    </div>
  );
}

// B: "Karte" – Noto Sans, large avatar with flag, place as hero on the
// right, key numbers in a bottom strip.
function drawB(d: Data) {
  const { th, t } = d;
  const stat = (value: string, label: string) => (
    <span style={{ display: "flex", alignItems: "center", height: 20, marginRight: 10, opacity: 0.85, whiteSpace: "nowrap" }}>
      <b style={{ marginRight: 3 }}>{value}</b>
      {label}
    </span>
  );
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", border: `1px solid ${th.frame}`, fontFamily: "Noto Sans" }}>
      <div style={{ display: "flex", flex: 1, padding: "7px 9px 0", alignItems: "center" }}>
        <div style={{ display: "flex", position: "relative", width: 58, height: 58 }}>
          <Avatar d={d} size={58} radius={6} />
          {d.rank ? (
            <div style={{ display: "flex", position: "absolute", right: -7, bottom: -5, width: 28, height: 28, borderRadius: 14, background: th.side, border: `1px solid ${th.border}`, alignItems: "center", justifyContent: "center" }}>
              <RankBadge name={d.rank.name} size={24} plain />
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Flag d={d} h={12} />
            <span style={{ fontSize: 15, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{d.name}</span>
          </div>
          <div style={{ display: "flex", fontSize: 9.5, color: th.muted, marginTop: 1 }}>
            {d.rank ? `${d.rank.title} · ` : ""}
            {d.n(d.points)} {t.points}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 4, fontSize: 8.5, color: th.muted }}>
            <Meter v={d.rank?.progress ?? 0} w={70} h={5} fill={th.accent} d={d} />
            <span style={{ marginLeft: 5 }}>{d.rank ? pct(d.rank.progress) : ""}</span>
            <span style={{ marginLeft: 10, marginRight: 4 }}>{t.activity}</span>
            <Meter v={d.act / 100} w={40} h={5} fill={activityColor(d.act / 100)} d={d} />
            <span style={{ marginLeft: 4 }}>{d.act}%</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginLeft: 8 }}>
          <div style={{ display: "flex", fontSize: 9, color: th.muted, textTransform: "uppercase", letterSpacing: 0.6 }}>{t.position}</div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: th.accent, lineHeight: 1 }}>{positionText(d)}</div>
          <div style={{ display: "flex", fontSize: 8.5, color: th.muted, marginTop: 1 }}>{d.position ? t.positionOf.replace("{n}", d.n(d.total)) : ""}</div>
          {d.brand ? <div style={{ display: "flex", fontSize: 8, fontWeight: 700, color: th.muted, marginTop: 2, maxWidth: 120, overflow: "hidden", whiteSpace: "nowrap" }}>{d.brand}</div> : null}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", height: 20, marginTop: 6, padding: "0 9px", background: th.side, borderTop: th.stripe ? `2px solid ${th.stripe}` : `1px solid ${th.border}`, fontSize: 9, color: th.sideText }}>
        <Fits h={20}>
          {stat(d.n(d.kills), t.kills)}
          {stat(d.n(d.deaths), t.deaths)}
          {stat(d.n(d.kpd, 2), t.kpd)}
          {stat(`${Math.round(d.hsPct * 100)}%`, t.hs)}
          {stat(fmtDuration(d.time), "")}
        </Fits>
        <Host d={d} gap={0} />
      </div>
    </div>
  );
}

// C: "Plakette" – Inter, accent block with the place on the left, rank
// progress as a line along the bottom edge.
function drawC(d: Data) {
  const { th, t } = d;
  const item = (label: string, value: string, color = th.text) => (
    <div style={{ display: "flex", flexDirection: "column", marginRight: 13 }}>
      <div style={{ display: "flex", fontSize: 7.5, color: th.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color }}>{value}</div>
    </div>
  );
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", border: `1px solid ${th.frame}`, fontFamily: "Inter" }}>
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 74, background: th.stripe ?? th.accent, color: onColor(th.stripe ?? th.accent) }}>
          <div style={{ display: "flex", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8, opacity: 0.85 }}>{t.position}</div>
          <div style={{ display: "flex", fontSize: d.position && d.position > 999 ? 17 : 24, fontWeight: 700, lineHeight: 1.05 }}>{positionText(d)}</div>
          <div style={{ display: "flex", fontSize: 8, opacity: 0.85 }}>{d.position ? `/ ${d.n(d.total)}` : ""}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "7px 10px 0" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {d.rank ? <RankBadge name={d.rank.name} size={26} plain /> : null}
            <div style={{ display: "flex", flexDirection: "column", marginLeft: d.rank ? 6 : 0, flex: 1, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <Flag d={d} />
                <span style={{ fontSize: 14, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 210 }}>{d.name}</span>
              </div>
              <div style={{ display: "flex", fontSize: 8.5, color: th.muted }}>
                {d.rank ? `${d.rank.title} · ` : ""}
                {d.n(d.points)} {t.points}
              </div>
            </div>
            <Avatar d={d} size={28} radius={14} />
          </div>
          <div style={{ display: "flex", marginTop: 6 }}>
            {item(t.kills, d.n(d.kills))}
            {item(t.deaths, d.n(d.deaths))}
            {item(t.kpd, d.n(d.kpd, 2), d.kpd >= 1 ? th.good : th.bad)}
            {item(t.hs, `${Math.round(d.hsPct * 100)}%`)}
            {item(t.activity, `${d.act}%`, activityColor(d.act / 100))}
            {item(t.playTime, fmtDuration(d.time))}
          </div>
          <div style={{ display: "flex", fontSize: 8, color: th.muted, marginTop: "auto", marginBottom: 4, justifyContent: "space-between" }}>
            <span>{d.host}</span>
            <span style={{ color: th.accent, fontWeight: 700 }}>{d.brand}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", height: 3, background: th.barBg }}>
        <div style={{ display: "flex", width: pct(d.rank?.progress ?? 0), background: th.accent }} />
      </div>
    </div>
  );
}

// Avatar and flag are embedded so the image renders even if Steam or the flag
// server is slow later. Only from Steam's avatar hosts, without following
// redirects, and at most AVATAR_MAX bytes (a full avatar is about 30 KB).
const AVATAR_MAX = 512 * 1024;

async function toDataUrl(raw: string): Promise<string | null> {
  const url = steamAvatarUrl(raw);
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: "error" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\/(jpeg|png|gif|webp)/.test(type)) return null;
    if (Number(res.headers.get("content-length") ?? 0) > AVATAR_MAX) return null;
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > AVATAR_MAX) return null;
    return `data:${type};base64,${body.toString("base64")}`;
  } catch {
    return null;
  }
}

// D: "Verlauf" – the points of the last 30 days as a line with the change,
// name and rank on the left, key numbers in a bottom strip.
function drawD(d: Data) {
  const { th, t } = d;
  const paths = sparkPaths(d.trend);
  const change = d.change;
  const color = change > 0 ? th.good : change < 0 ? th.bad : th.muted;
  const stat = (value: string, label: string) => (
    <span style={{ display: "flex", alignItems: "center", height: 19, marginRight: 9, whiteSpace: "nowrap" }}>
      <b style={{ marginRight: 3, color: th.sideText }}>{value}</b>
      {label}
    </span>
  );
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", border: `1px solid ${th.frame}`, borderTop: th.stripe ? `3px solid ${th.stripe}` : `1px solid ${th.frame}`, fontFamily: "Inter" }}>
      <div style={{ display: "flex", flex: 1, padding: "6px 9px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 170, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Avatar d={d} size={26} />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 6, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <Flag d={d} />
                <span style={{ fontSize: 13, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{d.name}</span>
              </div>
              <div style={{ display: "flex", fontSize: 8, color: th.muted, whiteSpace: "nowrap" }}>{d.rank?.title ?? ""}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: th.accent, lineHeight: 1 }}>{positionText(d)}</span>
            <span style={{ fontSize: 9, color: th.muted, marginLeft: 6, marginBottom: 1 }}>
              {d.n(d.points)} {t.points}
            </span>
          </div>
          {d.brand ? <div style={{ display: "flex", fontSize: 8, fontWeight: 700, color: th.muted, marginTop: 4, overflow: "hidden", whiteSpace: "nowrap" }}>{d.brand}</div> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontSize: 8, color: th.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>{t.points} · {t.last30}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color, lineHeight: 1 }}>{d.trend.length ? `${change > 0 ? "+" : change < 0 ? "−" : "±"}${d.n(Math.abs(change))}` : "–"}</span>
          </div>
          <div style={{ display: "flex", marginTop: 3, height: 40, borderBottom: `1px solid ${th.border}` }}>
            {paths ? (
              <svg width="196" height="40" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none">
                <path d={paths.area} fill={color} fillOpacity="0.18" />
                <path d={paths.line} fill="none" stroke={color} strokeWidth="1.5" />
              </svg>
            ) : (
              <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", fontSize: 9, color: th.muted }}>{t.noData}</div>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", height: 19, marginTop: 5, padding: "0 9px", background: th.side, fontSize: 8.5, color: th.sideText, opacity: 0.95 }}>
        <Fits h={19}>
          {stat(d.n(d.kills), t.kills)}
          {stat(d.n(d.kpd, 2), t.kpd)}
          {stat(`${Math.round(d.hsPct * 100)}%`, t.hs)}
          {stat(`${d.act}%`, t.activity)}
        </Fits>
        <Host d={d} gap={0} />
      </div>
    </div>
  );
}

// Activity colour as on the site: red at 0 %, through yellow, to green.
function activityColor(v: number) {
  const [r, g, b] = hsl(120 * clamp(v), 0.8, 0.5);
  return `rgb(${r},${g},${b})`;
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
