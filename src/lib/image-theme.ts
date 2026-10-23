import "server-only";
import { listTemplates, templateCss } from "./templates";

// Colours for the generated pictures (forum signature, server banner), taken
// from a design template's theme.css, so every template, own ones included,
// has a matching picture style. "classic" is the grey gameME look.

export type ImageTheme = {
  bg: string;
  side: string;
  // Text on the side panel, the frame and the stripe on top.
  sideText: string;
  frame: string;
  stripe: string | null;
  text: string;
  muted: string;
  accent: string;
  good: string;
  bad: string;
  border: string;
  barBg: string;
  barBorder: string;
};

export const CLASSIC_STYLE = "classic";

const CLASSIC: ImageTheme = {
  bg: "linear-gradient(180deg, #4a4a4a 0%, #262626 100%)",
  side: "rgba(0,0,0,0.25)",
  sideText: "#e6e6e6",
  frame: "#111111",
  stripe: null,
  text: "#e6e6e6",
  muted: "#bdbdbd",
  accent: "#ff8000",
  good: "#4cc38a",
  bad: "#ff4d4d",
  border: "#111111",
  barBg: "#3a3a3a",
  barBorder: "#555555",
};

export const STYLE_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;

// Only plain colour values reach the picture; anything else (var(), url(),
// images) falls back to the classic colour.
const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[0-9.]+%?\s*,\s*[0-9.]+%?\s*,\s*[0-9.]+%?\s*(,\s*[0-9.]+%?\s*)?\)|[a-z]{3,20})$/;

function vars(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/--([a-z0-9-]{1,40})\s*:\s*([^;{}]{1,200});/g)) if (!out.has(m[1])) out.set(m[1], m[2].trim());
  return out;
}

export async function imageTheme(style: string): Promise<ImageTheme> {
  if (style === CLASSIC_STYLE || !STYLE_ID.test(style)) return CLASSIC;
  const css = await templateCss(style);
  if (!css) return CLASSIC;
  const v = vars(css);
  const c = (name: string, fallback: string) => {
    const x = v.get(name);
    return x && COLOR.test(x) ? x : fallback;
  };
  const surface = c("surface", "#262626");
  const accent = c("accent", CLASSIC.accent);
  const page = c("page", "#333333");
  // The side panel shows the template's own colour: its header gradient when
  // that is a plain two-colour gradient, else its page colour (the coloured
  // templates such as blue, green, orange, red).
  const header = /^linear-gradient\(\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)$/.exec(v.get("header-bg") ?? "");
  const side = header ? `linear-gradient(180deg, ${header[1]} 0%, ${header[2]} 100%)` : `linear-gradient(180deg, ${page} 0%, ${shade(page, 0.55)} 100%)`;
  const glow = rgba(accent, 0.16);
  return {
    bg: glow ? `linear-gradient(135deg, ${glow} 0%, rgba(0,0,0,0) 40%), linear-gradient(180deg, ${c("surface-2", "#4a4a4a")} 0%, ${surface} 100%)` : `linear-gradient(180deg, ${c("surface-2", "#4a4a4a")} 0%, ${surface} 100%)`,
    side,
    sideText: c("logo-text", "#ffffff"),
    frame: header ? header[2] : shade(page, 0.7),
    stripe: accent,
    text: c("text", CLASSIC.text),
    muted: c("muted", CLASSIC.muted),
    accent,
    good: c("good", CLASSIC.good),
    bad: c("bad", CLASSIC.bad),
    border: c("border", CLASSIC.border),
    barBg: c("bar-bg", CLASSIC.barBg),
    barBorder: c("bar-border", CLASSIC.barBorder),
  };
}

// The styles to choose from besides the classic default: every template.
export async function imageStyles(lang: "de" | "en"): Promise<{ id: string; name: string }[]> {
  return (await listTemplates()).map((t) => ({ id: t.id, name: t.name[lang] }));
}

function hex(c: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(c);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function rgba(c: string, a: number): string | null {
  const x = hex(c);
  return x ? `rgba(${x[0]},${x[1]},${x[2]},${a})` : null;
}

// The colour darkened to the given share (0.5 = half as bright).
function shade(c: string, f: number): string {
  const x = hex(c);
  return x ? `rgb(${x.map((n) => Math.round(n * f)).join(",")})` : c;
}

// "12" or "12-dark" (with or without .png): the id and the style; no style
// means the classic look.
export function parseImageFile(file: string): { id: number; style: string | null } | null {
  const m = /^(\d{1,10})(?:-([a-z0-9][a-z0-9_-]{0,31}))?(?:\.png)?$/.exec(file);
  return m ? { id: Number(m[1]), style: m[2] ?? null } : null;
}
