import "server-only";
import { ImageResponse } from "next/og";
import type { ImageTheme } from "@/lib/image-theme";
import { Backdrop } from "./backdrop";
import { bannerFonts } from "./fonts";
import { fitSize, sizePx, type BannerOptions } from "./options";

// The 560x95 banners (server, TeamSpeak) in their layouts (f only the server), and the
// small (350x20) and tall (160x400) sizes of all three banners. The
// banner's own file (server-banner.tsx, voice-banner.tsx) reads the data and
// fills a Wide; this file only draws it.
const W = 560;
const H = 95;

// status: the online state (layouts B and C show it beside the name); full:
// never shortened, the cell takes the room the others leave (TeamSpeak address).
// map: the current map (the tall side strip layout shows mapImage under it).
export type Cell = { label: string; value: string; color?: string; pie?: number; status?: boolean; full?: boolean; map?: boolean };

export type Wide = {
  th: ImageTheme;
  // Small label over the name ("Server", "TeamSpeak").
  kind: string;
  name: string;
  flag: string | null;
  // The server's game: its short name (games.ts) and icon as a data: URL.
  game?: { short: string; icon: string | null };
  // The big number: players or users online of the slots.
  hero: { label: string; value: string; max: string; share: number; note: string };
  online: boolean;
  status: string;
  // Up to five cells in the order of layout A's columns: top, bottom, top, bottom, top.
  cells: Cell[];
  // Players of the last 24 hours (server only): points 0..1 and the scale.
  graph: { label: string; points: [number, number][]; ticks: number[]; top: number } | null;
  host: string;
  // The page of the player, server or TeamSpeak server (the HTML banner links to it).
  link: string;
  // Only in the HTML banner: the name is a link to link.
  href?: string;
  // Only for the tall side strip layout (server): the map picture as a data:
  // URL (src null: none, the box shows the text none) and the best players
  // of the ranking.
  mapImage?: { src: string | null; none: string };
  top?: { label: string; players: { name: string; link: string }[] };
  // The player's rank insignia (player banner in the small and tall sizes).
  badge?: React.ReactNode;
  // The values of the small size, when not those of the tall one; label "" shows the value alone.
  small?: Cell[];
};

// Also the small and tall sizes of all three kinds (o.size), the player's too.
export async function wideBanner(w: Wide, o: BannerOptions, maxAge: number): Promise<Response> {
  if (o.html) w = { ...w, href: w.link };
  const draw = o.size === "small" ? drawSmall : o.size === "tall" ? (o.layout === "e" ? drawTallStrip : drawTall) : ({ a: drawA, b: drawB, c: drawC, e: drawE, f: drawF }[o.layout] ?? drawA);
  const [width, height] = o.size === "normal" ? [W, H] : sizePx("server", o.size);
  const picture = (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: w.th.bg }}>
      <Backdrop bg={o.bg} th={w.th} />
      {draw(w)}
    </div>
  );
  if (o.html) return htmlBanner(picture, width, height, o.lang, maxAge);
  return new ImageResponse(picture, { width, height, fonts: await bannerFonts(), headers: { "cache-control": `public, max-age=${maxAge}` } });
}

// The HTML banner (a file ending in .html): the same drawing as the picture,
// since it only uses flex boxes with inline styles, as a page of its own for
// an <iframe> on other sites (next.config.ts allows the framing for it and
// blocks everything else), reloaded every maxAge seconds. Real text that can
// be selected and copied; the name is the link to the page (Linked), so the
// rest is not one big link. The page loads nothing: avatar, flags and the
// map picture are data: URLs, the font is the reader's own (the inline "Inter" of the
// drawing would fall back to a serif font without it).
export async function htmlBanner(picture: React.ReactElement, width: number, height: number, lang: string, maxAge: number): Promise<Response> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(<div style={{ display: "flex", width, height }}>{picture}</div>);
  const page = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta http-equiv="refresh" content="${maxAge}"><title>gameWE</title><style>html,body{margin:0;overflow:hidden}*{box-sizing:border-box;font-family:Inter,"Segoe UI",Roboto,Helvetica,Arial,system-ui,sans-serif!important}a:hover{text-decoration:underline!important}</style></head><body>${body}</body></html>`;
  return new Response(page, {
    // Its content-security-policy comes from next.config.ts.
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=${maxAge}` },
  });
}

// The name as a link in the HTML banner (href set), plain text in the picture.
export function Linked({ href, children }: { href?: string; children: React.ReactNode }) {
  return href ? (
    <a href={href} target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "none" }}>
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}

const frame = (th: ImageTheme, column = false) =>
  ({
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: column ? "column" : "row",
    border: `1px solid ${th.frame}`,
    borderTop: th.stripe ? `3px solid ${th.stripe}` : `1px solid ${th.frame}`,
    fontFamily: "Inter",
  }) as const;

function Flag({ src, h = 12 }: { src: string | null; h?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} width={Math.round((h * 4) / 3)} height={h} style={{ marginRight: 5, borderRadius: 1 }} alt="" /> : null;
}

// The game's icon and short name (server banners), e.g. "CS:S".
function GameChip({ w, h = 11, size = 9, gap = 0 }: { w: Wide; h?: number; size?: number; gap?: number }) {
  if (!w.game) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", flexShrink: 0, marginLeft: gap, marginRight: 5, fontSize: size, fontWeight: 700, lineHeight: 1, letterSpacing: 0, textTransform: "none", color: w.th.text, whiteSpace: "nowrap" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {w.game.icon ? <img src={w.game.icon} width={h} height={h} style={{ marginRight: 3, borderRadius: 2 }} alt="" /> : null}
      {w.game.short}
    </div>
  );
}

function Pie({ share, th, size = 24 }: { share: number; th: ImageTheme; size?: number }) {
  const r = 9;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill={th.barBg} stroke={th.barBorder} strokeWidth="1" />
      <circle cx="12" cy="12" r={r / 2} fill="none" stroke={th.good} strokeWidth={r} strokeDasharray={`${(share * circ) / 2} ${circ}`} transform="rotate(-90 12 12)" />
    </svg>
  );
}

// The players graph in a box of w x h, with or without its scale.
function Graph({ g, th, w, h, scale }: { g: NonNullable<Wide["graph"]>; th: ImageTheme; w: number; h: number; scale: boolean }) {
  const pts = g.points.map(([x, y]) => `${(x * w).toFixed(1)},${(h - y * h).toFixed(1)}`).join(" ");
  return (
    <div style={{ display: "flex" }}>
      {scale ? (
        <div style={{ display: "flex", position: "relative", width: 18, height: h }}>
          {g.ticks.map((v) => (
            <div key={v} style={{ display: "flex", position: "absolute", right: 3, top: Math.min(h - 9, Math.max(0, h - (v / g.top) * h - 5)), fontSize: 8, lineHeight: 1, color: th.sideText }}>
              {v}
            </div>
          ))}
        </div>
      ) : null}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect x="0" y="0" width={w} height={h} fill={th.barBg} stroke={th.barBorder} strokeWidth="1" />
        {g.ticks.slice(1, -1).map((v) => (
          <line key={v} x1="0" x2={w} y1={h - (v / g.top) * h} y2={h - (v / g.top) * h} stroke={th.barBorder} strokeWidth="0.6" strokeDasharray="2 2" />
        ))}
        {g.points.length > 1 ? <polyline points={pts} fill="none" stroke={th.accent} strokeWidth="1.5" /> : null}
      </svg>
    </div>
  );
}

function Logo({ th, size = 13, color }: { th: ImageTheme; size?: number; color?: string }) {
  return (
    <div style={{ display: "flex", fontSize: size, fontWeight: 700, color: color ?? th.text }}>
      game<span style={{ color: th.accent }}>WE</span>
    </div>
  );
}

function StatusDot({ w }: { w: Wide }) {
  return <div style={{ display: "flex", width: 7, height: 7, borderRadius: 4, background: w.online ? w.th.good : w.th.bad, marginRight: 5 }} />;
}

const SIDE = 128;
const INFO = W - 2 - SIDE - 16;
const GAP = 12;
const COL = 160;

// A: "Klar" – side panel (the graph, or the big number; side: something
// else there), name over three columns of label and value, the logo in the
// bottom right corner.
function drawA(w: Wide, side?: React.ReactNode) {
  const { th } = w;
  const label = { display: "flex", fontSize: 8.5, fontWeight: 700, color: th.accent, letterSpacing: 0.4, textTransform: "uppercase" } as const;
  const value = { display: "block", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;
  const cell = (c: Cell | undefined, maxWidth = INFO) =>
    c ? (
      <div style={{ display: "flex", alignItems: "center", minWidth: 0, maxWidth }}>
        {c.pie !== undefined ? <Pie share={c.pie} th={th} /> : null}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, maxWidth, overflow: "hidden", marginLeft: c.pie !== undefined ? 5 : 0 }}>
          <div style={label}>{c.label}</div>
          <div style={{ ...value, maxWidth, color: c.color ?? th.text, ...(c.full ? { fontSize: fitSize(c.value, 250, 13) } : {}) }}>{c.value}</div>
        </div>
      </div>
    ) : null;
  const [c0, c1, c2, c3, c4] = w.cells;
  const sideLabel = { display: "flex", fontSize: 8, fontWeight: 700, color: th.sideText, letterSpacing: 0.3, textTransform: "uppercase", whiteSpace: "nowrap" } as const;
  return (
    <div style={frame(th)}>
      {side ? (
        <div style={{ display: "flex", flexDirection: "column", width: SIDE, padding: "4px 6px", background: th.side }}>{side}</div>
      ) : w.graph ? (
        <div style={{ display: "flex", flexDirection: "column", width: SIDE, padding: "4px 6px", background: th.side }}>
          <div style={sideLabel}>{w.graph.label}</div>
          <div style={{ display: "flex", marginTop: 3 }}>
            <Graph g={w.graph} th={th} w={SIDE - 12 - 18} h={66} scale />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: SIDE, padding: "4px 6px 6px", background: th.side }}>
          <div style={sideLabel}>{w.hero.label}</div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", color: th.sideText }}>
            <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{w.hero.value}</span>
            <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1, marginLeft: 3, marginBottom: 2, opacity: 0.75 }}>/{w.hero.max}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", width: SIDE - 12, height: 6, borderRadius: 3, background: th.barBg, overflow: "hidden" }}>
              <div style={{ display: "flex", width: `${Math.round(w.hero.share * 100)}%`, height: "100%", background: w.online ? th.good : th.bad }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 8, color: th.sideText, marginTop: 2 }}>{w.hero.note}</div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "5px 8px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={label}>{w.kind}</div>
            <GameChip w={w} gap={6} />
          </div>
          <div style={{ display: "flex", alignItems: "center", width: INFO }}>
            <Flag src={w.flag} />
            <span style={{ ...value, color: th.text, width: w.flag ? INFO - 21 : INFO }}><Linked href={w.href}>{w.name}</Linked></span>
          </div>
        </div>
        <div style={{ display: "flex", height: 54 }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", ...(c0?.full ? { flex: 1, minWidth: 0 } : { maxWidth: COL }), marginRight: GAP }}>
            {cell(c0, c0?.full ? INFO : COL)}
            {cell(c1, COL)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flexShrink: 0, maxWidth: COL, marginRight: GAP }}>
            {cell(c2, COL)}
            {cell(c3, COL)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", ...(c0?.full ? { flexShrink: 0 } : { flex: 1, minWidth: 0 }) }}>
            {cell(c4)}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "auto" }}>
              <Logo th={th} />
              <div style={{ display: "flex", fontSize: 8, color: th.muted, maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap" }}>{w.host}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// F: "Kartenbild" – layout A with the map picture (or the "no map image"
// box) in the side panel instead of the graph (server): the same label line
// and the same box as the graph, framed like it.
export const MAP_PANEL_W = SIDE - 12;
export const MAP_PANEL_H = 66;
function drawF(w: Wide) {
  const { th } = w;
  const label = w.cells.find((c) => c.map)?.label ?? "";
  return drawA(
    w,
    w.mapImage ? (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 8, fontWeight: 700, color: th.sideText, letterSpacing: 0.3, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ display: "flex", marginTop: 3, flexShrink: 0 }}>
          <MapBox th={th} m={w.mapImage} w={MAP_PANEL_W} h={MAP_PANEL_H} framed />
        </div>
      </div>
    ) : undefined,
  );
}

// B: "Karte" – name with status, the graph and the big number on the right,
// the other values in a bottom strip.
function drawB(w: Wide) {
  const { th } = w;
  const rest = w.cells.filter((c) => c.pie === undefined && !c.status);
  const small = { display: "flex", fontSize: 8.5, color: th.muted, letterSpacing: 0.6, textTransform: "uppercase" } as const;
  return (
    <div style={frame(th, true)}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", padding: "0 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          {w.kind || w.game ? (
            <div style={{ display: "flex", alignItems: "center" }}>
              {w.kind ? <div style={{ ...small, marginRight: 6 }}>{w.kind}</div> : null}
              <GameChip w={w} />
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", marginTop: 1 }}>
            <Flag src={w.flag} h={13} />
            <span style={{ display: "block", fontSize: 17, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: w.graph ? 250 : 370 }}><Linked href={w.href}>{w.name}</Linked></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 4, fontSize: 10 }}>
            <StatusDot w={w} />
            <span style={{ color: w.online ? th.good : th.bad, fontWeight: 700 }}>{w.status}</span>
          </div>
        </div>
        {w.graph ? (
          <div style={{ display: "flex", flexDirection: "column", marginRight: 14 }}>
            <div style={{ ...small, fontSize: 7.5, letterSpacing: 0.4, marginBottom: 2 }}>{w.graph.label}</div>
            <Graph g={w.graph} th={th} w={110} h={36} scale={false} />
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={small}>{w.hero.label}</div>
          <div style={{ display: "flex", alignItems: "flex-end", color: th.accent, lineHeight: 1 }}>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{w.hero.value}</span>
            <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 2, marginBottom: 2, opacity: 0.8 }}>/{w.hero.max}</span>
          </div>
          <div style={{ display: "flex", fontSize: 8.5, color: th.muted }}>{w.hero.note}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", height: 22, padding: "0 12px", background: th.side, borderTop: `1px solid ${th.border}`, fontSize: 9.5, color: th.sideText }}>
        {rest.map((c) => (
          <span key={c.label} style={{ display: "flex", marginRight: 12, ...(c.full ? { minWidth: 0 } : { maxWidth: 150 }), overflow: "hidden", whiteSpace: "nowrap" }}>
            <span style={{ opacity: 0.7, marginRight: 4 }}>{c.label}</span>
            <b style={c.full ? { fontSize: fitSize(c.value, 190, 9.5) } : {}}>{c.value}</b>
          </span>
        ))}
        <span style={{ display: "flex", marginLeft: "auto", opacity: 0.7, marginRight: 8 }}>{w.host}</span>
        <Logo th={th} size={10} color={th.sideText} />
      </div>
    </div>
  );
}

// C: "Plakette" – accent block with the big number, the values in a row,
// the share of the slots as a line along the bottom edge.
function drawC(w: Wide) {
  const { th } = w;
  const block = th.stripe ?? th.accent;
  const fg = onColor(block);
  const cells = w.cells.filter((c) => c.pie === undefined && !c.status);
  return (
    <div style={{ ...frame(th, true), borderTop: `1px solid ${th.frame}` }}>
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 100, background: block, color: fg }}>
          <div style={{ display: "flex", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8, opacity: 0.85, maxWidth: 92, overflow: "hidden", whiteSpace: "nowrap" }}>{w.hero.label}</div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, lineHeight: 1.05 }}>{w.hero.value}</div>
          <div style={{ display: "flex", fontSize: 9, opacity: 0.85 }}>/ {w.hero.max}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, padding: "7px 12px 0" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <GameChip w={w} h={12} size={10} />
            <Flag src={w.flag} h={12} />
            <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: w.game ? 280 : 340 }}><Linked href={w.href}>{w.name}</Linked></span>
            <div style={{ display: "flex", marginLeft: "auto", alignItems: "center", fontSize: 9, fontWeight: 700, color: w.online ? th.good : th.bad }}>
              <StatusDot w={w} />
              {w.status}
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 8 }}>
            {cells.map((c) => (
              <div key={c.label} style={{ display: "flex", flexDirection: "column", marginRight: 16, ...(c.full ? { minWidth: 0 } : { maxWidth: 150 }), overflow: "hidden" }}>
                <div style={{ display: "flex", fontSize: 7.5, color: th.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{c.label}</div>
                <div style={{ display: "block", fontSize: c.full ? fitSize(c.value, 255, 12) : 12, fontWeight: 700, color: c.color ?? th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: "auto", marginBottom: 4, fontSize: 8, color: th.muted, justifyContent: "space-between", alignItems: "flex-end" }}>
            <span>{w.host}</span>
            <Logo th={th} size={10} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", height: 3, background: th.barBg }}>
        <div style={{ display: "flex", width: `${Math.round(w.hero.share * 100)}%`, background: w.online ? th.good : th.bad }} />
      </div>
    </div>
  );
}

// E: "Seitenband" – layout B with an accent strip on the left whose label
// (Server, TeamSpeak) runs from top to bottom; the strip already says what
// it is, so B leaves out its label.
function drawE(w: Wide) {
  return (
    <SideStrip th={w.th} label={w.kind} height={H}>
      {drawB({ ...w, kind: "" })}
    </SideStrip>
  );
}

// The accent strip of layout E (also the player banner's) left of the
// banner's drawing, its label from top to bottom.
// big: the tall banner's strip, the name in larger letters; href: the label
// is a link (HTML banner).
export function SideStrip({ th, label, href, height, big = false, children }: { th: ImageTheme; label: string; href?: string; height: number; big?: boolean; children: React.ReactNode }) {
  const strip = big ? 24 : 22;
  const size = big ? 12 : 9;
  // Shortened by hand: Satori draws no ellipsis in the turned box.
  // shortcut: about 0.75 em per upper-case letter plus the spacing, estimated; measure with Satori if names clip.
  const room = Math.floor((height - 16) / (size * 0.75 + (big ? 1 : 2)));
  const text = label.length > room ? `${label.slice(0, room - 1).trimEnd()}…` : label;
  const block = th.stripe ?? th.accent;
  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      <div style={{ display: "flex", position: "relative", width: strip, flexShrink: 0, background: block, overflow: "hidden" }}>
        {/* A box as long as the banner is high, turned clockwise into the strip. */}
        <div style={{ display: "flex", position: "absolute", width: height, height: strip, left: (strip - height) / 2, top: (height - strip) / 2, transform: "rotate(90deg)", alignItems: "center", justifyContent: big ? "flex-start" : "center", padding: "0 8px", fontFamily: "Inter", fontSize: size, fontWeight: 700, letterSpacing: big ? 1 : 2, textTransform: "uppercase", whiteSpace: "nowrap", color: onColor(block) }}>
          <Linked href={href}>{text}</Linked>
        </div>
      </div>
      <div style={{ display: "flex", flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// The values beside the big number: no pie (that is the big number) and no
// status (the dot shows it).
const extra = (w: Wide) => w.cells.filter((c) => c.pie === undefined && !c.status);

// Small, 350x20: one line with status dot, flag, name, the big number and
// as many values as fit; whatever does not fit wraps into the hidden second
// line and drops out whole; a full value (the TeamSpeak address) stays and
// the name gives way.
function drawSmall(w: Wide) {
  const { th } = w;
  const cells = w.small ?? extra(w);
  const item = (c: Cell) => (
    <span key={c.label + c.value} style={{ display: "flex", flexShrink: 0, alignItems: "center", height: 18, marginLeft: 7, whiteSpace: "nowrap", color: th.muted }}>
      {c.label ? <span style={{ marginRight: 3 }}>{c.label}</span> : null}
      <b style={{ color: c.color ?? th.text }}>{c.value}</b>
    </span>
  );
  return (
    <div style={{ ...frame(th), borderTop: `1px solid ${th.frame}`, alignItems: "center", padding: "0 5px", fontSize: 9.5, color: th.text }}>
      {w.status ? <StatusDot w={w} /> : null}
      <GameChip w={w} h={10} size={9} />
      <Flag src={w.flag} h={9} />
      <span style={{ display: "block", flexShrink: 1, minWidth: 30, maxWidth: w.game ? 80 : 120, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Linked href={w.href}>{w.name}</Linked></span>
      <span style={{ display: "flex", flexShrink: 0, marginLeft: 7, fontWeight: 700, color: th.accent, whiteSpace: "nowrap" }}>
        {w.hero.value}
        <span style={{ opacity: 0.75 }}>/{w.hero.max}</span>
      </span>
      {cells.filter((c) => c.full).map(item)}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", flex: 1, minWidth: 0, height: 18, overflow: "hidden", marginLeft: 3 }}>
        {cells.filter((c) => !c.full).map(item)}
      </div>
      <div style={{ display: "flex", flexShrink: 0, marginLeft: 6 }}>
        <Logo th={th} size={9.5} />
      </div>
    </div>
  );
}

// Tall, 160x400: name on top, the big number with its share of the slots
// (or the rank insignia), the graph, the values as rows of label and value,
// logo and site address at the bottom.
function drawTall(w: Wide) {
  const { th } = w;
  const small = { display: "flex", fontSize: 8, color: th.muted, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" } as const;
  return (
    <div style={{ ...frame(th, true), padding: "8px 9px 7px" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={small}>{w.kind}</div>
        <GameChip w={w} gap={6} />
      </div>
      <div style={{ display: "flex", alignItems: "center", marginTop: 2 }}>
        <Flag src={w.flag} h={11} />
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: w.flag ? 124 : 140 }}><Linked href={w.href}>{w.name}</Linked></span>
      </div>
      {w.status ? (
        <div style={{ display: "flex", alignItems: "center", marginTop: 3, fontSize: 9.5, fontWeight: 700, color: w.online ? th.good : th.bad }}>
          <StatusDot w={w} />
          {w.status}
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 10, padding: "8px 0", background: th.side, color: th.sideText, borderRadius: 3 }}>
        {w.badge ? <div style={{ display: "flex", marginBottom: 4 }}>{w.badge}</div> : null}
        <div style={{ ...small, color: th.sideText }}>{w.hero.label}</div>
        <div style={{ display: "flex", alignItems: "flex-end", lineHeight: 1, marginTop: 2 }}>
          <span style={{ fontSize: 30, fontWeight: 700 }}>{w.hero.value}</span>
          <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 2, marginBottom: 3, opacity: 0.75 }}>/{w.hero.max}</span>
        </div>
        <div style={{ display: "flex", width: 120, height: 5, marginTop: 6, borderRadius: 3, background: th.barBg, overflow: "hidden" }}>
          <div style={{ display: "flex", width: `${Math.round(w.hero.share * 100)}%`, height: "100%", background: w.status && !w.online ? th.bad : w.status ? th.good : th.accent }} />
        </div>
        <div style={{ display: "flex", fontSize: 8, marginTop: 3, maxWidth: 136, overflow: "hidden", whiteSpace: "nowrap" }}>{w.hero.note}</div>
      </div>
      {w.graph ? (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 9 }}>
          <div style={small}>{w.graph.label}</div>
          <div style={{ display: "flex", marginTop: 3 }}>
            <Graph g={w.graph} th={th} w={142} h={44} scale={false} />
          </div>
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
        {/* A full value (the TeamSpeak address) under its label, over the whole width. */}
        {extra(w).map((c) => (
          <div key={c.label} style={{ display: "flex", flexDirection: c.full ? "column" : "row", justifyContent: "space-between", alignItems: c.full ? "flex-start" : "baseline", padding: "3px 0", borderBottom: `1px solid ${th.border}` }}>
            <span style={{ display: "flex", flexShrink: 0, fontSize: 8, color: th.muted, textTransform: "uppercase", letterSpacing: 0.3, marginRight: 6 }}>{c.label}</span>
            <span style={{ display: "block", fontSize: c.full ? fitSize(c.value, 140, 10.5) : 10.5, fontWeight: 700, color: c.color ?? th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: c.full ? 142 : 100 }}>{c.value}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto" }}>
        <Logo th={th} size={12} />
        <div style={{ display: "flex", fontSize: fitSize(w.host, 140, 8), color: th.muted, whiteSpace: "nowrap" }}>{w.host}</div>
      </div>
    </div>
  );
}

// Tall with layout e: the name from top to bottom in the side strip, beside
// it stacked sections, each a small label bar over its value: what it is
// (flag, status), the big number, the values, the map with its radar picture,
// the players of the last 24 hours and the best players (server).
const TCW = 160 - 24 - 12 - 2;
function drawTallStrip(w: Wide) {
  const { th } = w;
  const sec = (label: string, body: React.ReactNode, key?: string) => (
    <div key={key} style={{ display: "flex", flexDirection: "column", marginBottom: 4 }}>
      <div style={{ display: "flex", fontSize: 7, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", color: th.sideText, background: th.side, padding: "2px 4px", borderRadius: 2 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", padding: "2px 4px 0", fontSize: 10.5, fontWeight: 700, color: th.text }}>{body}</div>
    </div>
  );
  const line = (text: string, color?: string, size = 10.5) => (
    <span style={{ display: "block", maxWidth: TCW - 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color, fontSize: size }}>{text}</span>
  );
  return (
    <SideStrip th={th} label={w.name} href={w.href} height={400} big>
      <div style={{ ...frame(th, true), padding: "6px 6px 5px" }}>
        {sec(
          w.kind,
          <div style={{ display: "flex", alignItems: "center", fontSize: 9.5 }}>
            <Flag src={w.flag} h={10} />
            <GameChip w={w} h={10} size={9.5} />
            {w.status ? <StatusDot w={w} /> : null}
            {line(w.status || w.hero.note, w.status ? (w.online ? th.good : th.bad) : th.muted, 9.5)}
          </div>,
        )}
        {sec(
          w.hero.label,
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "flex-end", lineHeight: 1 }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{w.hero.value}</span>
                <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 2, marginBottom: 2, opacity: 0.75 }}>/{w.hero.max}</span>
              </div>
              {w.badge ? <div style={{ display: "flex", width: 30, height: 30 }}>{w.badge}</div> : null}
            </div>
            <div style={{ display: "flex", width: TCW - 8, height: 5, marginTop: 3, borderRadius: 3, background: th.barBg, overflow: "hidden" }}>
              <div style={{ display: "flex", width: `${Math.round(w.hero.share * 100)}%`, height: "100%", background: w.status && !w.online ? th.bad : w.status ? th.good : th.accent }} />
            </div>
          </div>,
        )}
        {extra(w).map((c) =>
          sec(
            c.label,
            <div style={{ display: "flex", flexDirection: "column" }}>
              {line(c.value, c.color, c.full ? fitSize(c.value, TCW - 8, 10.5) : 10.5)}
              {c.map && w.mapImage ? <MapBox th={th} m={w.mapImage} w={TCW - 8} h={46} /> : null}
            </div>,
            c.label,
          ),
        )}
        {w.graph ? sec(w.graph.label, <Graph g={w.graph} th={th} w={TCW - 8} h={28} scale={false} />) : null}
        {w.top && w.top.players.length
          ? sec(
              w.top.label,
              <div style={{ display: "flex", flexDirection: "column", fontSize: 9 }}>
                {w.top.players.map((p, i) => (
                  <div key={i} style={{ display: "flex" }}>
                    <span style={{ display: "flex", width: 12, color: th.muted }}>{i + 1}.</span>
                    <span style={{ display: "block", maxWidth: TCW - 20, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Linked href={w.href ? p.link : undefined}>{p.name}</Linked>
                    </span>
                  </div>
                ))}
              </div>,
            )
          : null}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto" }}>
          <Logo th={th} size={11} />
          <div style={{ display: "flex", fontSize: fitSize(w.host, TCW, 7.5), color: th.muted, whiteSpace: "nowrap" }}>{w.host}</div>
        </div>
      </div>
    </SideStrip>
  );
}

// The map picture, or a quiet box of the same size with a picture sign and
// "no map picture".
// framed: in the graph's place (layout F), with the graph's frame.
function MapBox({ th, m, w, h, framed = false }: { th: ImageTheme; m: { src: string | null; none: string }; w: number; h: number; framed?: boolean }) {
  const place = framed ? { marginTop: 0, borderRadius: 0, flexShrink: 0 } : { marginTop: 2, borderRadius: 2 };
  if (m.src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.src} width={w} height={h} style={{ ...place, objectFit: "cover", background: th.barBg, ...(framed ? { border: `1px solid ${th.barBorder}` } : {}) }} alt="" />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: w, height: h, ...place, background: th.barBg, border: `1px ${framed ? "solid" : "dashed"} ${th.barBorder}`, color: th.muted }}>
      <svg width="18" height="14" viewBox="0 0 18 14">
        <rect x="0.75" y="0.75" width="16.5" height="12.5" rx="1.5" fill="none" stroke={th.muted} strokeWidth="1.5" />
        <circle cx="5.5" cy="4.5" r="1.6" fill={th.muted} />
        <polyline points="1.5,12 7,7 10,10 12.5,8 16.5,12" fill="none" stroke={th.muted} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", fontSize: 7.5, fontWeight: 700, marginTop: 3, letterSpacing: 0.3 }}>{m.none}</div>
    </div>
  );
}

// Text colour on a plain colour: dark on light ones (luminance), else white.
export function onColor(c: string) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c) ?? /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (!m) return "#fff";
  const [r, g, b] = m.slice(1, 4).map((h) => parseInt(h.length === 1 ? h + h : h, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111" : "#fff";
}
