// Builds the "modern" template family: templates/modern-<colour>/{theme.css,
// chart.json,template.json}. The layout rules live once in
// modern-templates/layout.css; each variant only adds its colours. The site
// loads a single plain theme.css per template (no @import, no url()), so the
// shared rules are copied into every generated file.
//
//   node scripts/modern-templates.mjs          write the files
//   node scripts/modern-templates.mjs --check  exit 1 if a file is out of date
//
// Edit this script or layout.css, never the generated files.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const layout = readFileSync(path.join(here, "modern-templates", "layout.css"), "utf8");

// ------------------------------------------------------------ base palettes

const DARK = {
  vars: {
    "--page": "#121213",
    "--page-pattern":
      "radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.045), transparent 60%), radial-gradient(ellipse at 50% 120%, rgba(0, 0, 0, 0.7), transparent 60%), repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.012) 0 2px, transparent 2px 4px)",
    "--surface": "#1b1b1c",
    "--surface-2": "#262628",
    "--panel": "#18181a",
    "--row-group": "#29292b",
    "--border": "#2c2c2f",
    "--text": "#e4e4e6",
    "--soft": "#c9c9cc",
    "--th-bg": "#1b1b1c",
    "--muted": "#8e8e93",
    "--good": "#4cc38a",
    "--bad": "#ff5c5c",
    "--line-bg": "#1b1b1c",
    "--line-text": "#e4e4e6",
    "--grid": "#2a2a2d",
    "--grid-2": "#3a3a3e",
    "--bar-bg": "#2a2a2d",
    "--bar-border": "#3a3a3e",
    "--band": "#1d1d1f",
    "--band-odd": "#222225",
    "--input-bg": "#111112",
    "--input-text": "#e4e4e6",
    "--input-border": "#3a3a3e",
    "--header-bg": "#121213",
    "--header-border": "#262628",
    "--logo-text": "#ffffff",
    "--error-bg": "#3a1414",
    "--error-text": "#ffd6d6",
  },
  scheme: "dark",
  own: {
    "--m-head": "#232325",
    "--m-bar": "#09090a",
    "--m-bar-border": "#1c1c1e",
    "--m-bar-shadow": "#222225",
    "--m-header-shadow": "rgba(0, 0, 0, 0.6)",
    "--m-zebra": "#202022",
    "--m-hover": "#2a2a2d",
    "--m-line": "#333336",
    "--m-outline": "#3a3a3e",
    "--m-strong": "#ffffff",
    "--m-foot-logo": "#5a5a5f",
    "--m-foot-text": "#77777c",
    "--m-foot-link": "#9a9a9f",
    "--m-icon": "#2c2c2f",
    "--m-error-border": "#6b2222",
    "--m-team-a": "#7ab8ff",
    "--m-team-b": "#ff8080",
    "--m-srv-full": "#ff6b6b",
    "--m-srv-nempty": "#5aa9ff",
    "--m-pbar-good": "#2f9a64",
    "--m-pbar-low": "#b58a00",
    "--m-ct": "#2f6fc0",
    "--m-danger": "#b83232",
    "--m-avatar": "radial-gradient(circle at 35% 30%, #333333, #141414)",
  },
  banner: {
    top: "#1f1f21",
    bottom: "#141415",
    side: ["#19191a", "#0d0d0e"],
    sideText: "#ffffff",
    frame: "#0d0d0e",
    text: "#e4e4e6",
    muted: "#8e8e93",
    good: "#4cc38a",
    bad: "#ff5c5c",
    border: "#2c2c2f",
    barBg: "#2a2a2d",
    barBorder: "#3a3a3e",
    tint: 0.12,
  },
  chart: {
    background: "#1b1b1c",
    border: "#2c2c2f",
    grid: "#29292c",
    axis: "#8e8e93",
    axisStrong: "#c9c9cc",
    dayLine: "#3a3a3e",
    guide: "#8e8e93",
    title: "#e4e4e6",
    legend: "#a5a5aa",
    dotEdge: "#1b1b1c",
    pieEdge: "#1b1b1c",
    barHover: "rgba(255, 255, 255, 0.06)",
    band: "#1d1d1f",
    bandOdd: "#222225",
    uptime: "#4cc38a",
    gain: "#4cc38a",
    loss: "#ff5c5c",
    tooltip: { background: "#232325", text: "#e4e4e6", border: "#3a3a3e" },
    spark: { total: "#4a4a4f", current: "#2f6fc0", totalLine: "#8e8e93", currentLine: "#5aa9ff" },
    radarTotal: "#5aa9ff",
    // Colours after the first one or two of each list, in this order; a colour
    // too close in hue to the template's own ones is skipped.
    pool: ["#4a90e2", "#f0b400", "#ff6b6b", "#4cc38a", "#b388ff", "#4dd0e1", "#f48fb1", "#ffd54f", "#7ab8ff", "#ff9e40", "#c0c0c0", "#9e9e9e", "#8e8e93"],
    heatmapBackground: "#0d1117",
  },
};

const LIGHT = {
  vars: {
    "--page": "#eceef1",
    "--page-pattern": "radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.8), transparent 60%)",
    "--surface": "#ffffff",
    "--surface-2": "#f2f3f5",
    "--panel": "#f7f8fa",
    "--row-group": "#e6e9ed",
    "--border": "#dcdfe4",
    "--text": "#1d2127",
    "--soft": "#3b424c",
    "--th-bg": "#ffffff",
    "--muted": "#646b75",
    "--good": "#13703f",
    "--bad": "#b71c1c",
    "--line-bg": "#ffffff",
    "--line-text": "#1d2127",
    "--grid": "#e6e8ec",
    "--grid-2": "#c9ced5",
    "--bar-bg": "#e6e8ec",
    "--bar-border": "#c9ced5",
    "--band": "#f6f7f9",
    "--band-odd": "#eceef1",
    "--input-bg": "#ffffff",
    "--input-text": "#1d2127",
    "--input-border": "#c3c8cf",
    "--header-bg": "#ffffff",
    "--header-border": "#dcdfe4",
    "--logo-text": "#14181d",
    "--error-bg": "#fde2e2",
    "--error-text": "#7a1414",
  },
  scheme: "light",
  own: {
    "--m-head": "#f4f5f7",
    "--m-bar": "#e3e6ea",
    "--m-bar-border": "#d3d7dd",
    "--m-bar-shadow": "#d3d7dd",
    "--m-header-shadow": "rgba(0, 0, 0, 0.06)",
    "--m-zebra": "#f7f8fa",
    "--m-hover": "#edf0f4",
    "--m-line": "#dcdfe4",
    "--m-outline": "#c3c8cf",
    "--m-strong": "#111418",
    "--m-foot-logo": "#a0a6ae",
    "--m-foot-text": "#646b75",
    "--m-foot-link": "#3b424c",
    "--m-icon": "#eceef1",
    "--m-error-border": "#e3a0a0",
    "--m-team-a": "#1f5fae",
    "--m-team-b": "#b02a2a",
    "--m-srv-full": "#c62828",
    "--m-srv-nempty": "#1f6fc2",
    "--m-pbar-good": "#2f9a64",
    "--m-pbar-low": "#c99a00",
    "--m-ct": "#2f6fc0",
    "--m-danger": "#b83232",
    "--m-avatar": "radial-gradient(circle at 35% 30%, #e6e8ec, #c3c8cf)",
  },
  banner: {
    top: "#ffffff",
    bottom: "#e9ecef",
    side: ["#f4f5f7", "#dde1e6"],
    sideText: "#14181d",
    frame: "#c3c8cf",
    text: "#1d2127",
    muted: "#646b75",
    good: "#13703f",
    bad: "#b71c1c",
    border: "#dcdfe4",
    barBg: "#e6e8ec",
    barBorder: "#c3c8cf",
    tint: 0.1,
  },
  chart: {
    background: "#ffffff",
    border: "#dcdfe4",
    grid: "#eceef1",
    axis: "#646b75",
    axisStrong: "#3b424c",
    dayLine: "#c9ced5",
    guide: "#646b75",
    title: "#1d2127",
    legend: "#4c535d",
    dotEdge: "#ffffff",
    pieEdge: "#ffffff",
    barHover: "rgba(0, 0, 0, 0.05)",
    band: "#f6f7f9",
    bandOdd: "#eceef1",
    uptime: "#2e9e5e",
    gain: "#2e9e5e",
    loss: "#d64545",
    tooltip: { background: "#ffffff", text: "#1d2127", border: "#c3c8cf" },
    spark: { total: "#b8bec6", current: "#2f7dc0", totalLine: "#8a9099", currentLine: "#1f5fae" },
    radarTotal: "#2f7dc0",
    pool: ["#2f7dc0", "#c62828", "#2e9e5e", "#7e57c2", "#b58a00", "#00897b", "#d81b60", "#e07b00", "#5c6bc0", "#6d6d6d", "#8a9099", "#a0a6ae"],
    heatmapBackground: "#0d1117",
  },
};

// ------------------------------------------------------------ variants

// accent: links, table heads, buttons, active tabs; accentText: hover and
// light text; hover: button hover; on: text on the accent colour;
// second: the second chart series (and radar total when it is blue).
const VARIANTS = [
  { id: "modern-gold", name: { de: "Modern Gold", en: "Modern gold" }, base: DARK, accent: "#f0b400", accentText: "#ffcf40", hover: "#ffc61a", on: "#111111", first: "#4a90e2", second: "#f0b400" },
  { id: "modern-orange", name: { de: "Modern Orange", en: "Modern orange" }, base: DARK, accent: "#ff8000", accentText: "#ffb066", hover: "#ff9433", on: "#111111" },
  { id: "modern-blue", name: { de: "Modern Blau", en: "Modern blue" }, base: DARK, accent: "#3d9bff", accentText: "#8cc4ff", hover: "#5aabff", on: "#0b0b0c", second: "#f0b400" },
  { id: "modern-red", name: { de: "Modern Rot", en: "Modern red" }, base: DARK, accent: "#ff4d4f", accentText: "#ff9a9c", hover: "#ff6b6d", on: "#111111" },
  { id: "modern-green", name: { de: "Modern Grün", en: "Modern green" }, base: DARK, accent: "#3cc35f", accentText: "#94e0a8", hover: "#55d176", on: "#0b0b0c" },
  { id: "modern-pink", name: { de: "Modern Pink", en: "Modern pink" }, base: DARK, accent: "#ff4fa3", accentText: "#ff9ccb", hover: "#ff6fb4", on: "#111111" },
  // Dark: neutral silver on a deeper black, charts in blue and gold.
  {
    id: "modern-dark", name: { de: "Modern Dunkel", en: "Modern dark" }, base: DARK, accent: "#d4d4d8", accentText: "#ffffff", hover: "#e8e8ec", on: "#111111", first: "#4a90e2", second: "#f0b400",
    vars: { "--page": "#0b0b0c", "--header-bg": "#0b0b0c", "--m-bar": "#050506" },
  },
  { id: "modern-light", name: { de: "Modern Hell", en: "Modern light" }, base: LIGHT, accent: "#c95c00", accentText: "#9a4500", hover: "#b35200", on: "#ffffff" },
];

// ------------------------------------------------------------ helpers

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Hue in degrees, or null for greys (no hue to clash with).
function hue(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.12) return null;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function near(a, b) {
  const ha = hue(a);
  const hb = hue(b);
  if (ha === null || hb === null) return a === b;
  const d = Math.abs(ha - hb);
  return Math.min(d, 360 - d) < 22;
}

// head first, then pool colours that are not too close to any taken one.
function palette(head, pool, size) {
  const out = [...head];
  for (const c of pool) if (out.length < size && !out.some((x) => near(x, c))) out.push(c);
  for (const c of pool) if (out.length < size && !out.includes(c)) out.push(c);
  return out;
}

function rgba(hex, a) {
  return `rgba(${rgb(hex).join(",")},${a})`;
}

// ------------------------------------------------------------ output

function themeCss(v) {
  const b = v.base;
  const vars = {
    ...b.vars,
    "--th-text": v.accent,
    "--accent": v.accent,
    "--accent-text": v.accentText,
    "--series-2": v.second ?? b.chart.pool[0],
    "--tab-bg": v.accent,
    "--tab-hover": v.hover,
    "--tab-border": v.accent,
    "--tab-text": v.on,
    "--tab-shadow": "none",
    "--bullet": "none",
    "--sec-icon": "none",
    "--title-shadow": "none",
    ...(v.vars ?? {}),
  };
  const own = {
    "--m-width": "940px",
    "--m-gutter": "16px",
    "--m-radius": "5px",
    "--m-font": '"Helvetica Neue", Helvetica, Arial, sans-serif',
    "--m-on-accent": v.on,
    ...b.own,
    ...Object.fromEntries(Object.entries(v.vars ?? {}).filter(([k]) => k.startsWith("--m-"))),
  };
  for (const k of Object.keys(own)) delete vars[k];
  const bn = b.banner;
  const banner = {
    "--banner-bg": `linear-gradient(135deg, ${rgba(v.accent, bn.tint)} 0%, rgba(0,0,0,0) 45%), linear-gradient(180deg, ${bn.top} 0%, ${bn.bottom} 100%)`,
    "--banner-side": `linear-gradient(180deg, ${bn.side[0]} 0%, ${bn.side[1]} 100%)`,
    "--banner-side-text": bn.sideText,
    "--banner-frame": bn.frame,
    "--banner-stripe": v.accent,
    "--banner-text": bn.text,
    "--banner-muted": bn.muted,
    "--banner-accent": v.accent,
    "--banner-good": bn.good,
    "--banner-bad": bn.bad,
    "--banner-border": bn.border,
    "--banner-bar-bg": bn.barBg,
    "--banner-bar-border": bn.barBorder,
  };
  const block = (o) => Object.entries(o).map(([k, val]) => `  ${k}: ${val};`).join("\n");
  return `/* gameWE template "${v.id}" (${v.name.en}), one of the "modern" family:
   ${b.scheme}, flat and narrow. Header with big accent-coloured links, a bar
   for the ranking's sections, one centred content column and rounded cards
   with a title strip above each box. Unlike the classic templates it also
   changes the layout: the rules after the variables are scoped to
   html[data-skin] like the variables, so they only apply while this template
   is loaded.

   Generated by scripts/modern-templates.mjs from
   scripts/modern-templates/layout.css; edit those and run
   \`npm run templates\` instead of changing this file. A copy of this folder
   under another name (see README.md) can be edited freely. */
html[data-skin] {
${block(vars)}
  color-scheme: ${b.scheme};

  /* Own variables of the modern templates (layout) */
${block(own)}
}

${layout.trimEnd()}

/* Player banner (forum signature) and server banner, see README.md */
html[data-skin] {
${block(banner)}
}
`;
}

function chartJson(v) {
  const c = v.base.chart;
  const first = v.first ?? v.accent;
  const second = v.second ?? c.pool.find((x) => !near(x, first));
  const series = palette([first, second], c.pool, 8);
  const servers = palette([], c.pool.filter((x) => x !== series[0] && !near(x, first)), 8);
  const pie = palette([v.accent], c.pool, 9);
  const radarTotal = near(c.radarTotal, v.accent) ? second : c.radarTotal;
  const json = {
    background: c.background,
    border: c.border,
    grid: c.grid,
    axis: c.axis,
    axisStrong: c.axisStrong,
    dayLine: c.dayLine,
    guide: c.guide,
    title: c.title,
    legend: c.legend,
    dotEdge: c.dotEdge,
    pieEdge: c.pieEdge,
    barHover: c.barHover,
    band: c.band,
    bandOdd: c.bandOdd,
    uptime: c.uptime,
    gain: c.gain,
    loss: c.loss,
    tooltip: { ...c.tooltip, title: v.accentText },
    spark: c.spark,
    radar: { total: radarTotal, current: v.accent },
    series,
    servers,
    pie,
    heatmapBackground: c.heatmapBackground,
  };
  return JSON.stringify(json, null, 2) + "\n";
}

const check = process.argv.includes("--check");
let stale = 0;
for (const v of VARIANTS) {
  const dir = path.join(root, "templates", v.id);
  const files = {
    "theme.css": themeCss(v),
    "chart.json": chartJson(v),
    "template.json": JSON.stringify({ name: v.name }, null, 2) + "\n",
  };
  if (!check) mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(dir, name);
    const old = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (old === text) continue;
    if (check) {
      console.error(`out of date: templates/${v.id}/${name}`);
      stale++;
    } else {
      writeFileSync(file, text);
      console.log(`wrote templates/${v.id}/${name}`);
    }
  }
}
if (stale) {
  console.error("run `npm run templates` and commit the result");
  process.exit(1);
}
