// Colours of the generated pictures (player banner / forum signature, server
// banner) from a design template's theme.css: its banner definition, the
// --banner-* variables (see templates/README.md). A template without one, and
// every value it leaves out, gets the Dark banner (darkBanner). Pure
// functions without file access, so tests can run them directly.

import { replacedTemplate } from "./skin-fallback.ts";

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

export const STYLE_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;

// The banner variables of a template: --banner-<name> → field.
export const BANNER_VARS: [name: string, field: keyof ImageTheme][] = [
  ["bg", "bg"],
  ["side", "side"],
  ["side-text", "sideText"],
  ["frame", "frame"],
  ["stripe", "stripe"],
  ["text", "text"],
  ["muted", "muted"],
  ["accent", "accent"],
  ["good", "good"],
  ["bad", "bad"],
  ["border", "border"],
  ["bar-bg", "barBg"],
  ["bar-border", "barBorder"],
];

// The banner of the built-in "dark" template (the same values as the
// --banner-* block of templates/dark/theme.css, tests/banner-theme.test.ts
// checks that).
const DARK: ImageTheme = {
  bg: "linear-gradient(135deg, rgba(255,128,0,0.16) 0%, rgba(0,0,0,0) 40%), linear-gradient(180deg, #202022 0%, #161617 100%)",
  side: "linear-gradient(180deg, #1f1f22 0%, #121214 100%)",
  sideText: "#ffffff",
  frame: "#121214",
  stripe: "#ff8000",
  text: "#e9e9ea",
  muted: "#9a9aa0",
  accent: "#ff8000",
  good: "#4cc38a",
  bad: "#ff4d4d",
  border: "#2c2c30",
  barBg: "#2c2c30",
  barBorder: "#46464c",
};

// Fallback for a template without a banner definition (and for the values
// a definition leaves out): the Dark banner. Change it here.
export function darkBanner(): ImageTheme {
  return { ...DARK };
}

// Only plain colour values reach the picture; anything else (var(), url(),
// images) is ignored.
const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[0-9.]+%?\s*,\s*[0-9.]+%?\s*,\s*[0-9.]+%?\s*(,\s*[0-9.]+%?\s*)?\)|[a-z]{3,20})$/;
const STOP = /^(.+?)(\s+\d{1,3}%)?$/;

function isColor(v: string | undefined): boolean {
  return !!v && COLOR.test(v);
}

// Split at the commas outside parentheses; null for unbalanced ones.
function split(s: string): string[] | null {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")" && --depth < 0) return null;
    else if (s[i] === "," && depth === 0) {
      out.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (depth !== 0) return null;
  out.push(s.slice(start).trim());
  return out;
}

// A background (bg, side): a colour, or up to three linear gradients of
// colours with optional positions in % and an optional angle in deg.
function isBackground(v: string | undefined): v is string {
  if (isColor(v)) return true;
  if (!v || v.length > 300) return false;
  const layers = split(v);
  return !!layers && layers.length <= 3 && layers.every((layer) => {
    const m = /^linear-gradient\((.*)\)$/.exec(layer);
    const parts = m ? split(m[1]) : null;
    if (!parts) return false;
    if (/^\d{1,3}deg$/.test(parts[0])) parts.shift();
    return parts.length >= 2 && parts.length <= 6 && parts.every((p) => isColor(STOP.exec(p)?.[1]));
  });
}

function valid(field: keyof ImageTheme, v: string | undefined): v is string {
  return field === "bg" || field === "side" ? isBackground(v) : isColor(v);
}

export function cssVars(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/--([a-z0-9-]{1,40})\s*:\s*([^;{}]{1,300});/g)) if (!out.has(m[1])) out.set(m[1], m[2].trim());
  return out;
}

// Does the template define its banner (at least one valid --banner-* value)?
export function hasBannerDefinition(css: string | null): boolean {
  if (!css) return false;
  const v = cssVars(css);
  return BANNER_VARS.some(([name, field]) => valid(field, v.get(`banner-${name}`)));
}

// The banner of a template (css null: no template): its --banner-* values
// over the Dark banner. A --banner-stripe of "none" drops the stripe.
export function bannerTheme(css: string | null): ImageTheme {
  const th = darkBanner();
  if (!css) return th;
  const v = cssVars(css);
  for (const [name, field] of BANNER_VARS) {
    const x = v.get(`banner-${name}`);
    if (field === "stripe" && x === "none") th.stripe = null;
    else if (valid(field, x)) th[field] = x;
  }
  return th;
}

// The template a picture style names, or null for the active skin: no style,
// a name that is no template, and the old "classic" (gone, its URLs in
// forum posts keep working in the skin's banner). A removed built-in template
// ("12-blue.png" in old posts) gives its replacement (skin-fallback.ts).
export function chosenTemplate(style: string | null, templates: string[]): string | null {
  if (!style || !STYLE_ID.test(style)) return null;
  const id = replacedTemplate(style, templates);
  return templates.includes(id) ? id : null;
}

// "12" or "12-dark" (with or without .png): the id and the style; no style
// means the active skin. Any style name is accepted here ("12-classic" from
// old posts included); one that is no template falls back to the skin.
export function parseImageFile(file: string): { id: number; style: string | null } | null {
  const m = /^(\d{1,10})(?:-([a-z0-9][a-z0-9_-]{0,31}))?(?:\.png)?$/.exec(file);
  return m ? { id: Number(m[1]), style: m[2] ?? null } : null;
}

// "teamspeak.png" or "teamspeak-dark.png": the TeamSpeak banner and its
// style (null: the active skin), the same style rules as parseImageFile.
export function parseVoiceBannerFile(file: string): { style: string | null } | null {
  const m = /^teamspeak(?:-([a-z0-9][a-z0-9_-]{0,31}))?\.png$/.exec(file);
  return m ? { style: m[1] ?? null } : null;
}
