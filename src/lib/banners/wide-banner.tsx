import "server-only";
import { ImageResponse } from "next/og";
import type { ImageTheme } from "@/lib/image-theme";
import { Backdrop } from "./backdrop";
import { bannerFonts } from "./fonts";
import { fitSize, sizePx, type BannerOptions } from "./options";

// The 560x95 banners (server, TeamSpeak) in their three layouts, and the
// small (350x20) and tall (160x400) sizes of all three banners. The
// banner's own file (server-banner.tsx, voice-banner.tsx) reads the data and
// fills a Wide; this file only draws it.
const W = 560;
const H = 95;

// status: the online state (layouts B and C show it beside the name); full:
// never shortened, the cell takes the room the others leave (TeamSpeak address).
export type Cell = { label: string; value: string; color?: string; pie?: number; status?: boolean; full?: boolean };

export type Wide = {
  th: ImageTheme;
  // Small label over the name ("Server", "TeamSpeak").
  kind: string;
  name: string;
  flag: string | null;
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
  // The player's rank insignia (player banner in the small and tall sizes).
  badge?: React.ReactNode;
  // The values of the small size, when not those of the tall one; label "" shows the value alone.
  small?: Cell[];
};

// Also the small and tall sizes of all three kinds (o.size), the player's too.
export async function wideBanner(w: Wide, o: BannerOptions, maxAge: number): Promise<Response> {
  const draw = o.size === "small" ? drawSmall : o.size === "tall" ? drawTall : ({ a: drawA, b: drawB, c: drawC }[o.layout] ?? drawA);
  const [width, height] = o.size === "normal" ? [W, H] : sizePx("server", o.size);
  const picture = (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: w.th.bg }}>
      <Backdrop bg={o.bg} th={w.th} />
      {draw(w)}
    </div>
  );
  if (o.html) return htmlBanner(w, picture, width, height, o.lang, maxAge);
  return new ImageResponse(picture, { width, height, fonts: await bannerFonts(), headers: { "cache-control": `public, max-age=${maxAge}` } });
}

// The HTML banner (a file ending in .html): the same drawing as the picture,
// since it only uses flex boxes with inline styles, as a page of its own for
// an <iframe> on other sites (next.config.ts allows the framing for it and blocks everything else), one
// link over all to the page, reloaded every maxAge seconds. The page loads
// nothing: avatar and flags are data: URLs, the font is the reader's own.
async function htmlBanner(w: Wide, picture: React.ReactElement, width: number, height: number, lang: string, maxAge: number): Promise<Response> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(
    <a href={w.link} target="_blank" rel="noopener" style={{ display: "flex", width, height, color: "inherit", textDecoration: "none" }}>
      {picture}
    </a>,
  );
  const page = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta http-equiv="refresh" content="${maxAge}"><title>gameWE</title><style>html,body{margin:0;overflow:hidden;font-family:Inter,"Segoe UI",Roboto,Helvetica,Arial,system-ui,sans-serif}*{box-sizing:border-box}</style></head><body>${body}</body></html>`;
  return new Response(page, {
    // Its content-security-policy comes from next.config.ts.
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=${maxAge}` },
  });
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

// A: "Klar" – side panel (the graph, or the big number), name over three
// columns of label and value, the logo in the bottom right corner.
function drawA(w: Wide) {
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
      {w.graph ? (
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
            <span style={{ ...value, color: th.text, width: w.flag ? INFO - 21 : INFO }}>{w.name}</span>
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
          <div style={small}>{w.kind}</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 1 }}>
            <Flag src={w.flag} h={13} />
            <span style={{ display: "block", fontSize: 17, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: w.graph ? 250 : 370 }}>{w.name}</span>
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
            <Flag src={w.flag} h={12} />
            <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 340 }}>{w.name}</span>
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
      <Flag src={w.flag} h={9} />
      <span style={{ display: "block", flexShrink: 1, minWidth: 30, maxWidth: 120, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.name}</span>
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
      <div style={small}>{w.kind}</div>
      <div style={{ display: "flex", alignItems: "center", marginTop: 2 }}>
        <Flag src={w.flag} h={11} />
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: w.flag ? 124 : 140 }}>{w.name}</span>
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

// Text colour on a plain colour: dark on light ones (luminance), else white.
export function onColor(c: string) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c) ?? /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (!m) return "#fff";
  const [r, g, b] = m.slice(1, 4).map((h) => parseInt(h.length === 1 ? h + h : h, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111" : "#fff";
}
