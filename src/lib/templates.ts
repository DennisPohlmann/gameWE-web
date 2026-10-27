import "server-only";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { basePath } from "./base-path";
import { chartCss } from "./chart-config";
import { OWN_TEMPLATES, retiredDirWarning } from "./content-dirs";
import { env } from "./env";
import { replacedTemplate } from "./skin-fallback";

// Look templates: one folder each with a theme.css (CSS variables, see
// templates/README.md), an optional template.json with the display name and an
// optional chart.json with the chart colours (src/lib/chart-config.ts).
// The built-in ones sit in templates/ next to the server; /var/lib/gamewe/web/templates
// adds your own (same name: yours wins, src/lib/content-dirs.ts). Only plain folders and files
// whose name is a short [a-z0-9_-] id count, no symlinks, so a name can never
// point outside these folders.

// mtime: the newest of theme.css and chart.json, for the stylesheet URL.
export type Template = { id: string; name: { de: string; en: string }; file: string; chart: string; mtime: number };

const ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const MAX_CSS = 256 * 1024;
const MAX_CHART = 16 * 1024;
// Up to this size a template's CSS goes into the page itself (one request
// less before the first paint); the larger generated "modern" templates stay
// a cached stylesheet, see themeStyle.
const INLINE_CSS = 4 * 1024;

let cache: { at: number; list: Template[] } | undefined;
let warned = false;

function roots(): string[] {
  if (!warned) {
    warned = true;
    const w = retiredDirWarning("TEMPLATES_DIR", env("TEMPLATES_DIR"), OWN_TEMPLATES);
    if (w) console.warn(w);
  }
  return [path.join(process.cwd(), "templates"), OWN_TEMPLATES];
}

async function scan(root: string): Promise<Template[]> {
  let names: string[];
  try {
    names = (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && ID.test(d.name)).map((d) => d.name);
  } catch {
    return [];
  }
  const out: Template[] = [];
  for (const id of names) {
    const file = path.join(root, id, "theme.css");
    const st = await lstat(file).catch(() => null);
    if (!st?.isFile() || st.size > MAX_CSS) continue;
    const chart = path.join(root, id, "chart.json");
    const cst = await lstat(chart).catch(() => null);
    const mtime = Math.max(st.mtimeMs, cst?.isFile() ? cst.mtimeMs : 0);
    out.push({ id, name: await readName(path.join(root, id, "template.json"), id), file, chart, mtime: Math.floor(mtime) });
  }
  return out;
}

async function readName(file: string, id: string): Promise<{ de: string; en: string }> {
  try {
    const st = await lstat(file);
    if (!st.isFile() || st.size > 4096) throw new Error();
    const n = JSON.parse(await readFile(file, "utf8"))?.name;
    const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60) : "");
    if (typeof n === "string" && clean(n)) return { de: clean(n), en: clean(n) };
    const de = clean(n?.de) || clean(n?.en) || id;
    return { de, en: clean(n?.en) || de };
  } catch {
    return { de: id, en: id };
  }
}

export async function listTemplates(): Promise<Template[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.list;
  const byId = new Map<string, Template>();
  for (const root of roots()) for (const t of await scan(root)) byId.set(t.id, t);
  const list = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  cache = { at: Date.now(), list };
  return list;
}

// The chosen template (a removed built-in one: its replacement, see
// skin-fallback.ts), else "dark", else "light", else the first one, else none
// (then the orange defaults of the stylesheet apply).
export async function resolveTemplate(id: string): Promise<Template | null> {
  const list = await listTemplates();
  const want = replacedTemplate(id, list.map((t) => t.id));
  return list.find((t) => t.id === want) ?? list.find((t) => t.id === "dark") ?? list.find((t) => t.id === "light") ?? list[0] ?? null;
}

// Game design: the template "game-<realgame>" (else "game-<code>"), shown on
// that game's pages when the setting is on.
export async function gameTemplate(realgame: string | null, code: string): Promise<Template | null> {
  const list = await listTemplates();
  return list.find((t) => t.id === `game-${realgame}`) ?? list.find((t) => t.id === `game-${code}`) ?? null;
}

// The <style> or <link> of a template for the page head: small templates
// (the classic ones, a few variables) are written into the page, so the
// browser needs no extra request before it can paint; large ones (the
// generated "modern" templates, about 23 KB) are linked, with the file time
// in the URL so the browser keeps them (see app/theme/[file]/route.ts).
export async function themeStyle(t: Template, scoped = false): Promise<{ css: string } | { href: string }> {
  const css = await templateCss(t.id, scoped);
  if (css !== null && css.length <= INLINE_CSS) return { css };
  return { href: `${basePath}/theme/${t.id}${scoped ? ".game" : ""}.css?v=${t.mtime}` };
}

// scoped: the selector becomes html[data-skin]:has(.skin-<id>), so the game
// design only applies while a game page (which renders that marker) is shown,
// and it wins over the site template whatever order the sheets load in.
export async function templateCss(id: string, scoped = false): Promise<string | null> {
  if (!ID.test(id)) return null;
  const t = (await listTemplates()).find((x) => x.id === id);
  if (!t) return null;
  const st = await lstat(t.file).catch(() => null);
  if (!st?.isFile() || st.size > MAX_CSS) return null;
  const theme = await readFile(t.file, "utf8");
  const css = theme + (await readChart(t, theme));
  return scoped ? css.replaceAll("html[data-skin]", `html[data-skin]:has(.skin-${id})`) : css;
}

// chart.json as a CSS block (always all chart variables, see chartCss; the
// theme.css resolves the defaults so repeated colours can be found). A
// missing, oversized, linked or broken file gives the defaults; dropped and
// replaced values are noted once per template version, by key only.
const noted = new Set<string>();

async function readChart(t: Template, theme: string): Promise<string> {
  let json: unknown = null;
  try {
    const st = await lstat(t.chart);
    if (st.isFile() && st.size <= MAX_CHART) json = JSON.parse(await readFile(t.chart, "utf8"));
  } catch {
    json = null;
  }
  const { css, dropped, replaced } = chartCss(json, theme);
  const key = `${t.id}:${t.mtime}`;
  if ((dropped.length || replaced.length) && !noted.has(key)) {
    noted.add(key);
    if (dropped.length) console.warn(`template ${t.id}: chart.json values ignored: ${dropped.join(", ")}`);
    if (replaced.length) console.warn(`template ${t.id}: repeated chart colours replaced: ${replaced.join(", ")}`);
  }
  return css;
}
