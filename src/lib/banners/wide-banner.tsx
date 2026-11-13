import "server-only";
import { ImageResponse } from "next/og";
import type { ImageTheme } from "@/lib/image-theme";
import { Backdrop } from "./backdrop";
import { bannerFonts } from "./fonts";
import { fitSize, sizePx, type BannerOptions } from "./options";
import { fitText, textWidth } from "./text-width.ts";

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
  // The server's game: its short name (games.ts, "CS:S") and icon as a data: URL.
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

// The game's icon and short name (server banners), e.g. "CS:S"; h the icon's size.
function GameValue({ g, h, size, color }: { g: NonNullable<Wide["game"]>; h: number; size: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flexShrink: 0, fontSize: size, fontWeight: 700, lineHeight: 1, color, whiteSpace: "nowrap" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {g.icon ? <img src={g.icon} width={h} height={h} style={{ marginRight: Math.round(h / 4), borderRadius: 2 }} alt="" /> : null}
      {g.short}
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

function StatusDot({ w, size = 7 }: { w: Wide; size?: number }) {
  return <div style={{ display: "flex", flexShrink: 0, width: size, height: size, borderRadius: size, background: w.online ? w.th.good : w.th.bad, marginRight: size < 7 ? 3 : 5 }} />;
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
  const value = { display: "flex", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" } as const;
  // A value in maxWidth px: smaller down to 10 px, else shortened with "…".
  const cell = (c: Cell | undefined, maxWidth = INFO) => {
    if (!c) return null;
    const f = c.full ? { text: c.value, size: fitSize(c.value, 250, 13) } : fitText(c.value, maxWidth - (c.pie !== undefined ? 29 : 0), 13, 10);
    return (
      <div style={{ display: "flex", alignItems: "center", minWidth: 0, maxWidth }}>
        {c.pie !== undefined ? <Pie share={c.pie} th={th} /> : null}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, maxWidth, overflow: "hidden", marginLeft: c.pie !== undefined ? 5 : 0 }}>
          <div style={label}>{c.label}</div>
          <div style={{ ...value, color: c.color ?? th.text, fontSize: f.size }}>{f.text}</div>
        </div>
      </div>
    );
  };
  const [c0, c1, c2, c3, c4] = w.cells;
  // The columns are as wide as their values; the third (the map) gets the rest.
  const colW = (a?: Cell, b?: Cell) => Math.min(COL, Math.max(...[a, b].map((c) => (c ? textWidth(c.value, 13) + (c.pie !== undefined ? 29 : 0) : 0))));
  const lastW = INFO - colW(c0, c1) - colW(c2, c3) - 2 * GAP;
  const name = fitText(w.name, w.flag ? INFO - 21 : INFO, 13, 10);
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
          <div style={label}>{w.kind}</div>
          <div style={{ display: "flex", alignItems: "center", width: INFO }}>
            <Flag src={w.flag} />
            <span style={{ ...value, color: th.text, fontSize: name.size }}><Linked href={w.href}>{name.text}</Linked></span>
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
            {cell(c4, c0?.full ? INFO : lastW)}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "auto" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                {w.game ? (
                  <div style={{ display: "flex", marginRight: 8 }}>
                    <GameValue g={w.game} h={14} size={12} color={th.text} />
                  </div>
                ) : null}
                <Logo th={th} />
              </div>
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
function drawB(w: Wide, accent = false) {
  const { th } = w;
  const rest = w.cells.filter((c) => c.pie === undefined && !c.status);
  const small = { display: "flex", fontSize: 8.5, color: th.muted, letterSpacing: 0.6, textTransform: "uppercase" } as const;
  const inner = W - 2 - 24 - (accent ? 8 : 0);
  // The name gets what the graph and the big number leave.
  const heroW = Math.max(textWidth(w.hero.value, 28) + textWidth(`/${w.hero.max}`, 13) + 2, textWidth(w.hero.note, 8.5), textWidth(w.hero.label, 8.5, 0.6));
  const name = fitText(w.name, inner - (w.graph ? 124 : 0) - heroW - 12 - (w.flag ? 18 : 0), 17, 11);
  // The bottom strip: the values from the left in what host, game and logo leave, the last one shortened.
  let left = inner - textWidth(w.host, 9.5) - 8 - textWidth("gameWE", 10) - (w.game ? (w.game.icon ? 15 : 0) + textWidth(w.game.short, 10) + 12 : 0) - 12;
  const strip = rest.map((c) => {
    const labelW = textWidth(c.label, 9.5) + 4;
    const f = fitText(c.value, Math.max(0, Math.min(c.full ? 190 : 150, left - labelW)), 9.5, 8);
    left -= labelW + textWidth(f.text, f.size) + 12;
    return { c, f };
  });
  return (
    <div style={frame(th)}>
      {accent ? <div style={{ display: "flex", width: 8, flexShrink: 0, background: th.stripe ?? th.accent }} /> : null}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", padding: "0 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          {w.kind ? <div style={small}>{w.kind}</div> : null}
          <div style={{ display: "flex", alignItems: "center", marginTop: 1 }}>
            <Flag src={w.flag} h={13} />
            <span style={{ display: "flex", fontSize: name.size, fontWeight: 700, color: th.text, whiteSpace: "nowrap" }}><Linked href={w.href}>{name.text}</Linked></span>
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <div style={small}>{w.hero.label}</div>
          <div style={{ display: "flex", alignItems: "flex-end", color: th.accent, lineHeight: 1 }}>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{w.hero.value}</span>
            <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 2, marginBottom: 2, opacity: 0.8 }}>/{w.hero.max}</span>
          </div>
          <div style={{ display: "flex", fontSize: 8.5, color: th.muted }}>{w.hero.note}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", height: 22, padding: "0 12px", background: th.side, borderTop: `1px solid ${th.border}`, fontSize: 9.5, color: th.sideText }}>
        {strip.map(({ c, f }) => (
          <span key={c.label} style={{ display: "flex", alignItems: "baseline", marginRight: 12, flexShrink: 0, whiteSpace: "nowrap" }}>
            <span style={{ opacity: 0.7, marginRight: 4 }}>{c.label}</span>
            <b style={{ fontSize: f.size }}>{f.text}</b>
          </span>
        ))}
        <div style={{ display: "flex", marginLeft: "auto" }}>
          {w.game ? <GameValue g={w.game} h={12} size={10} color={th.sideText} /> : null}
        </div>
        <span style={{ display: "flex", marginLeft: 12, opacity: 0.7, marginRight: 8, flexShrink: 0 }}>{w.host}</span>
        <Logo th={th} size={10} color={th.sideText} />
      </div>
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
  const inner = W - 2 - 100 - 24;
  // The name has the whole line; the values share theirs with the online state.
  const name = fitText(w.name, inner - (w.flag ? 17 : 0), 15, 11);
  let left = inner - (w.status ? textWidth(w.status, 9) + 12 + 10 : 0);
  const values = cells.map((c) => {
    const f = fitText(c.value, Math.max(0, Math.min(c.full ? 255 : 150, left)), 12, 9);
    left -= Math.max(textWidth(f.text, f.size), textWidth(c.label, 7.5, 0.5)) + 16;
    return { c, f };
  });
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
            <Flag src={w.flag} h={12} />
            <span style={{ display: "flex", fontSize: name.size, fontWeight: 700, color: th.text, whiteSpace: "nowrap" }}><Linked href={w.href}>{name.text}</Linked></span>
          </div>
          <div style={{ display: "flex", marginTop: 8 }}>
            {values.map(({ c, f }) => (
              <div key={c.label} style={{ display: "flex", flexDirection: "column", marginRight: 16, flexShrink: 0 }}>
                <div style={{ display: "flex", fontSize: 7.5, color: th.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{c.label}</div>
                <div style={{ display: "flex", fontSize: f.size, fontWeight: 700, color: c.color ?? th.text, whiteSpace: "nowrap" }}>{f.text}</div>
              </div>
            ))}
            {w.status ? (
              <div style={{ display: "flex", marginLeft: "auto", alignItems: "center", alignSelf: "flex-end", fontSize: 9, fontWeight: 700, color: w.online ? th.good : th.bad, flexShrink: 0 }}>
                <StatusDot w={w} />
                {w.status}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", marginTop: "auto", marginBottom: 4, fontSize: 8, color: th.muted, justifyContent: "space-between", alignItems: "flex-end" }}>
            <span>{w.host}</span>
            <div style={{ display: "flex", alignItems: "center" }}>
              {w.game ? (
                <div style={{ display: "flex", marginRight: 8 }}>
                  <GameValue g={w.game} h={13} size={11} color={th.text} />
                </div>
              ) : null}
              <Logo th={th} size={10} />
            </div>
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
  // Server: no turned strip (the game stands top right), a plain accent bar instead.
  if (w.game) return drawB(w, true);
  return (
    <SideStrip th={w.th} label={w.kind} height={H}>
      {drawB({ ...w, kind: "" })}
    </SideStrip>
  );
}

// The accent strip of layout E (also the player banner's) left of the
// banner's drawing, its label from top to bottom.
// big: the tall banner's strip, the name in larger letters; href: the label
// is a link (HTML banner); icon: a picture at the top, the label below it.
export function SideStrip({ th, label, href, height, big = false, icon, children }: { th: ImageTheme; label: string; href?: string; height: number; big?: boolean; icon?: string | null; children: React.ReactNode }) {
  const strip = big ? 24 : 22;
  const size = big ? 12 : 9;
  const top = icon ? strip : 0;
  const len = height - top;
  // Shortened by hand (Satori draws no ellipsis in the turned box), measured in capitals over the strip's whole length.
  const text = fitText(label.toUpperCase(), len - 16, size, size, big ? 1 : 2).text;
  const block = th.stripe ?? th.accent;
  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      <div style={{ display: "flex", position: "relative", width: strip, flexShrink: 0, background: block, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {icon ? <img src={icon} width={strip - 6} height={strip - 6} style={{ position: "absolute", left: 3, top: 4, borderRadius: 2 }} alt="" /> : null}
        {/* A box as long as the strip below the icon, turned clockwise into the strip. */}
        <div style={{ display: "flex", position: "absolute", width: len, height: strip, left: (strip - len) / 2, top: top + (len - strip) / 2, transform: "rotate(90deg)", alignItems: "center", justifyContent: big ? "flex-start" : "center", padding: "0 8px", fontFamily: "Inter", fontSize: size, fontWeight: 700, letterSpacing: big ? 1 : 2, textTransform: "uppercase", whiteSpace: "nowrap", color: onColor(block) }}>
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

// Small, 350x20, built like the classic GameTracker banner: game icon,
// status bar, the name small on top, below it in bold the first small value
// (server or TeamSpeak address), the big number and the further values (the
// last one shortened, what does not fit drops out), the players graph in a
// box and the gameWE mark at the end.
function drawSmall(w: Wide) {
  const { th } = w;
  const graph = w.graph;
  const B = 9.5;
  // 345 px inside frame and padding less icon, status bar, graph and mark.
  const room = 345 - (w.game?.icon ? 20 : 0) - (w.status ? 10 : 0) - (graph ? 56 : 0) - 20;
  const name = fitText(w.name, room - (w.flag ? 13 : 0), 7.5, 6.5);
  const cells = w.small ?? extra(w);
  const [lead, rest] = w.small ? [cells.slice(0, 1), cells.slice(1)] : [[], cells];
  const parts: { key: string; label: string; value: string; color: string }[] = [
    ...lead.map((c) => ({ key: c.label + c.value, label: c.label, value: c.value, color: c.color ?? th.text })),
    { key: "hero", label: "", value: `${w.hero.value}/${w.hero.max}`, color: th.text },
    ...rest.map((c) => ({ key: c.label + c.value, label: c.label, value: c.value, color: c.color ?? th.text })),
  ];
  // Fill line two left to right; the value that no longer fits is shortened, the rest dropped.
  let left = room;
  const shown: typeof parts = [];
  for (const p of parts) {
    const gap = shown.length ? 10 : 0;
    const label = p.label ? textWidth(`${p.label} `, B) : 0;
    const fit = fitText(p.value, left - gap - label, B);
    if (fit.text.length < 4 && fit.text !== p.value) break;
    shown.push({ ...p, value: fit.text });
    left -= gap + label + textWidth(fit.text, B);
    if (fit.text !== p.value) break;
  }
  const line = { display: "flex", alignItems: "center", lineHeight: 1, whiteSpace: "nowrap" } as const;
  return (
    <div style={{ ...frame(th), borderTop: `1px solid ${th.frame}`, alignItems: "center", padding: "0 2px 0 1px", color: th.text }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {w.game?.icon ? <img src={w.game.icon} width={16} height={16} style={{ flexShrink: 0, marginRight: 4, border: `1px solid ${th.frame}`, borderRadius: 1 }} alt="" /> : null}
      {w.status ? (
        <div style={{ display: "flex", alignSelf: "flex-start", flexShrink: 0, width: 6, height: 10, marginTop: 1, marginRight: 4, background: w.online ? th.good : th.bad, border: "1px solid rgba(0,0,0,0.6)" }} />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, minWidth: 0, height: 16 }}>
        <div style={{ ...line, height: 7, fontSize: name.size, fontWeight: 700, color: th.text, opacity: 0.85 }}>
          <Flag src={w.flag} h={6} />
          <span style={{ display: "flex", flexShrink: 0 }}><Linked href={w.href}>{name.text}</Linked></span>
        </div>
        <div style={{ ...line, height: 9, fontSize: B, fontWeight: 700 }}>
          {shown.map((p, i) => (
            <span key={p.key} style={{ ...line, flexShrink: 0, marginLeft: i ? 10 : 0, color: p.color }}>
              {p.label ? <span style={{ marginRight: 3, color: th.muted }}>{p.label}</span> : null}
              {p.value}
            </span>
          ))}
        </div>
      </div>
      {graph ? (
        <div style={{ display: "flex", flexShrink: 0, marginLeft: 3 }}>
          <Graph g={graph} th={th} w={50} h={14} scale={false} />
        </div>
      ) : null}
      <div style={{ display: "flex", flexShrink: 0, marginLeft: 3 }}>
        <Mark />
      </div>
    </div>
  );
}

// The gameWE mark (public/icon.svg) in 16 px, the square brand at the end of the small banner.
function Mark() {
  return (
    <svg width={16} height={16} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="#1b1b1b" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="3" />
      <path d="M16 3v7M16 22v7M3 16h7M22 16h7" stroke="#ff8000" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.4" fill="#ff8000" />
    </svg>
  );
}

// Tall, 160x400: name on top, the big number with its share of the slots
// (or the rank insignia), the graph, the values as rows of label and value,
// logo and site address at the bottom.
function drawTall(w: Wide) {
  const { th } = w;
  const tallName = fitText(w.name, w.flag ? 124 : 140, 13, 10);
  const small = { display: "flex", fontSize: 8, color: th.muted, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" } as const;
  return (
    <div style={{ ...frame(th, true), padding: "8px 9px 7px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={small}>{w.kind}</div>
        {w.game ? <GameValue g={w.game} h={14} size={12} color={th.text} /> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", marginTop: 2 }}>
        <Flag src={w.flag} h={11} />
        <span style={{ display: "flex", fontSize: tallName.size, fontWeight: 700, color: th.text, whiteSpace: "nowrap" }}><Linked href={w.href}>{tallName.text}</Linked></span>
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
            {(() => {
              const f = c.full ? { text: c.value, size: fitSize(c.value, 140, 10.5) } : fitText(c.value, 142 - textWidth(c.label, 8, 0.3) - 6, 10.5, 8.5);
              return <span style={{ display: "flex", fontSize: f.size, fontWeight: 700, color: c.color ?? th.text, whiteSpace: "nowrap" }}>{f.text}</span>;
            })()}
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
  const line = (text: string, color?: string, size = 10.5) => {
    const f = fitText(text, TCW - 8, size, Math.min(size, 8.5));
    return <span style={{ display: "flex", whiteSpace: "nowrap", color, fontSize: f.size }}>{f.text}</span>;
  };
  return (
    <SideStrip th={th} label={w.game ? `${w.game.short} · ${w.name}` : w.name} href={w.href} height={400} big icon={w.game?.icon}>
      <div style={{ ...frame(th, true), padding: "6px 6px 5px" }}>
        {sec(
          w.kind,
          <div style={{ display: "flex", alignItems: "center", fontSize: 9.5 }}>
            <Flag src={w.flag} h={10} />
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
                    <span style={{ display: "flex", whiteSpace: "nowrap" }}>
                      <Linked href={w.href ? p.link : undefined}>{fitText(p.name, TCW - 20, 9).text}</Linked>
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
