// The choices of a banner picture besides its colours (the design template
// in the file name): layout (?layout=) and background pattern (?bg=), plus
// the language: the folder right before the file (/banner/<game>/player/de/12.png,
// /sig/de/12.png, /banner/de/teamspeak.png; next.config.ts rewrites those to
// the address without it plus ?lang=), or ?lang= (the API). Unknown values give the defaults, so a mistyped address still
// shows a picture. Pure functions without file access, so tests can run them.

import { isLang, type Lang } from "../../translations/languages.ts";

export type BannerKind = "player" | "server" | "voice";

export const LAYOUTS: Record<BannerKind, readonly string[]> = {
  player: ["a", "b", "c", "d", "e"],
  server: ["a", "b", "c", "e", "f"],
  voice: ["a", "b", "c", "e"],
};

export const BACKGROUNDS = ["plain", "dots", "grid", "stripes", "carbon", "glow"] as const;
export type Background = (typeof BACKGROUNDS)[number];

// The size (?size=): "normal" is the banner of the layouts (player 400x100,
// server and TeamSpeak 560x95); "small" one line, "tall" upright, each in
// one design for all three kinds (wide-banner.tsx); the tall one also has
// layout e (side strip with the name), the other layouts do not apply.
export const SIZES = ["normal", "small", "tall"] as const;
export type Size = (typeof SIZES)[number];

export function sizePx(kind: BannerKind, size: Size): [number, number] {
  return size === "small" ? [350, 20] : size === "tall" ? [160, 400] : kind === "player" ? [400, 100] : [560, 95];
}

// html: a file ending in .html, the banner as a web page for an <iframe>
// (wide-banner.tsx), with live text and a link to the page; any size, the
// tall one when ?size= is missing (the first .html banners were only tall).
export type BannerOptions = { lang: Lang; layout: string; bg: Background; size: Size; html: boolean };

export function bannerOptions(kind: BannerKind, url: URL): BannerOptions {
  const q = url.searchParams;
  const parts = url.pathname.split("/");
  const folder = parts[parts.length - 2];
  const lang = isLang(folder) ? folder : (q.get("lang") ?? undefined);
  const layout = q.get("layout") ?? "";
  const bg = q.get("bg") ?? "";
  const html = url.pathname.endsWith(".html");
  const size = (SIZES as readonly string[]).includes(q.get("size") ?? "") ? (q.get("size") as Size) : html ? "tall" : "normal";
  return {
    lang: isLang(lang) ? lang : "en",
    // The normal size has layouts, the tall one also e (side strip); one cache entry per small picture.
    layout: (size === "normal" && LAYOUTS[kind].includes(layout)) || (size === "tall" && layout === "e") ? layout : "a",
    bg: (BACKGROUNDS as readonly string[]).includes(bg) ? (bg as Background) : "plain",
    size,
    html,
  };
}

// The language of the texts: the fonts have no Chinese, Japanese, Korean or
// Arabic glyphs (and Satori draws no right-to-left text), those pages get the
// English labels.
export const imageLang = (lang: Lang): Lang => (["zh-cn", "zh-tw", "ja", "ko", "ar"].includes(lang) ? "en" : lang);

// Part of the cache key: one render per distinct picture.
export function optionsKey(o: BannerOptions): string {
  return `${o.lang}|${o.layout}|${o.bg}|${o.size}${o.html ? "|html" : ""}`;
}

// A colour with transparency for the patterns: #rgb, #rrggbb and rgb()
// values; anything else (a name) a neutral grey.
export function tint(c: string, a: number): string {
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)?.[1];
  if (h) {
    const x = h.length === 3 ? [...h].map((d) => d + d) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
    return `rgba(${x.map((v) => parseInt(v, 16)).join(",")},${a})`;
  }
  const m = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/.exec(c);
  return m ? `rgba(${m[1]},${m[2]},${m[3]},${a})` : `rgba(128,128,128,${a})`;
}

// The pattern layer over the picture's background, drawn in the text colour
// (accent for "glow"); null for "plain".
export function backgroundLayer(bg: Background, text: string, accent: string): Record<string, string> | null {
  const c = tint(text, 0.09);
  switch (bg) {
    case "dots":
      return { backgroundImage: `radial-gradient(circle, ${tint(text, 0.16)} 0.9px, rgba(0,0,0,0) 1.3px)`, backgroundSize: "5px 5px" };
    case "grid":
      return { backgroundImage: `linear-gradient(90deg, ${c} 1px, rgba(0,0,0,0) 1px), linear-gradient(180deg, ${c} 1px, rgba(0,0,0,0) 1px)`, backgroundSize: "10px 10px" };
    case "stripes":
      return { backgroundImage: `repeating-linear-gradient(45deg, ${c} 0px, ${c} 1.5px, rgba(0,0,0,0) 1.5px, rgba(0,0,0,0) 7px)` };
    case "carbon":
      return {
        backgroundImage: `linear-gradient(45deg, ${c} 25%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 75%, ${c} 75%), linear-gradient(45deg, ${c} 25%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 75%, ${c} 75%)`,
        backgroundSize: "6px 6px",
        backgroundPosition: "0px 0px, 3px 3px",
      };
    case "glow":
      return { backgroundImage: `radial-gradient(circle at 78% 0%, ${tint(accent, 0.32)} 0%, rgba(0,0,0,0) 62%)` };
    default:
      return null;
  }
}

// The lists of the banner code box (components/sig-code.tsx) with their names.
export function bannerChoices(kind: BannerKind, t: { bannerLayouts: Record<string, string>; bannerBackgrounds: Record<string, string>; bannerSizes: Record<string, string> }) {
  return {
    sizes: SIZES.map((id) => {
      const [width, height] = sizePx(kind, id);
      return { id, name: `${t.bannerSizes[id] ?? id} (${width}×${height})`, width, height };
    }),
    layouts: LAYOUTS[kind].map((id) => ({ id, name: t.bannerLayouts[id] ?? id })),
    backgrounds: BACKGROUNDS.map((id) => ({ id, name: t.bannerBackgrounds[id] ?? id })),
  };
}

// Font size at which text fits into room px without being shortened (a Cell
// with full, the TeamSpeak address): size while it fits, smaller in half
// pixels down to 6. About 0.6 em per character of Inter bold.
// shortcut: estimated, not measured; past about 70 characters the text clips, measure with Satori if that matters.
export function fitSize(text: string, room: number, size: number): number {
  return Math.max(6, Math.min(size, Math.floor((room / (text.length * 0.6)) * 2) / 2));
}
