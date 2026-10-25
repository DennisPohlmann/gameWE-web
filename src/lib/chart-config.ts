// Chart colours of a design template: the optional chart.json next to its
// theme.css (see templates/README.md). Every value must be a plain colour
// (hex, rgb()/hsl() with numbers, a colour name or "transparent"), anything
// else is dropped and the default applies, so a chart.json can never inject
// CSS. The defaults below are the same as in the :root block of globals.css
// (tests/chart-config.test.ts checks that); most of them come from the
// template's theme.css, so a template without chart.json still matches.

export const SERIES = 8;
export const SERVERS = 8;
export const PIES = 9;

const SERIES_DEFAULTS = ["var(--accent)", "var(--series-2)", "var(--series-3, #d64541)", "#4caf50", "#a35ad8", "#e6c229", "#2fb5a8", "#d87aa0"];
const SERVER_DEFAULTS = ["#2f7dc0", "#2e9e2e", "#c03030", "#8a4fbf", "#c9a200", "#1aa0a0", "#d0609a", "#6b6b6b"];
const PIE_DEFAULTS = ["var(--accent)", "#3b8fd9", "#4caf50", "#d64545", "#a35ad8", "#e6c229", "#2fb5a8", "#d87aa0", "#8a8a8a"];

// chart.json key (a dot for nested objects) → CSS variable → default.
export const CHART_KEYS: [key: string, cssVar: string, fallback: string][] = [
  ["background", "--chart-bg", "var(--surface)"],
  ["border", "--chart-border", "var(--border)"],
  ["grid", "--chart-grid", "var(--grid)"],
  ["axis", "--chart-axis", "var(--muted)"],
  ["axisStrong", "--chart-axis-strong", "var(--text)"],
  ["dayLine", "--chart-day-line", "var(--grid-2)"],
  ["guide", "--chart-guide", "var(--muted)"],
  ["title", "--chart-title", "var(--text)"],
  ["legend", "--chart-legend", "var(--muted)"],
  ["dotEdge", "--chart-dot-edge", "var(--surface)"],
  ["pieEdge", "--chart-pie-edge", "var(--surface)"],
  ["barHover", "--chart-bar-hover", "color-mix(in srgb, var(--text) 8%, transparent)"],
  ["band", "--chart-band", "var(--band)"],
  ["bandOdd", "--chart-band-odd", "var(--band-odd)"],
  ["uptime", "--chart-uptime", "#6fbf73"],
  ["gain", "--chart-gain", "var(--good)"],
  ["loss", "--chart-loss", "var(--bad)"],
  ["tooltip.background", "--chart-tip-bg", "color-mix(in srgb, var(--surface) 94%, transparent)"],
  ["tooltip.text", "--chart-tip-text", "var(--text)"],
  ["tooltip.border", "--chart-tip-border", "var(--border)"],
  ["tooltip.title", "--chart-tip-title", "var(--accent-text)"],
  ["spark.total", "--chart-spark-total", "#555555"],
  ["spark.current", "--chart-spark-current", "#2f7dc0"],
  ["spark.totalLine", "--chart-spark-total-line", "#8a8a8a"],
  ["spark.currentLine", "--chart-spark-current-line", "#5aa9ff"],
  ["spark.text", "--chart-spark-text", "#ffffff"],
  ["spark.frame", "--chart-spark-frame", "var(--band)"],
  ["spark.edge", "--chart-spark-edge", "var(--grid-2)"],
  ["spark.line", "--chart-spark-line", "var(--soft)"],
  ["radar.total", "--chart-radar-total", "#8ca0ff"],
  ["radar.current", "--chart-radar-current", "var(--accent)"],
  ["radar.grid", "--chart-radar-grid", "var(--grid-2)"],
  ["radar.label", "--chart-radar-label", "var(--soft)"],
  ["heatmapBackground", "--chart-heat-bg", "#0d1117"],
  ["heatmapEdge", "--chart-heat-edge", "#ffffff"],
  ["heatmapKill", "--chart-heat-kill", "#33aaff"],
  ["heatmapDeath", "--chart-heat-death", "#e03030"],
  ...SERIES_DEFAULTS.map((d, i): [string, string, string] => [`series.${i}`, `--chart-series-${i + 1}`, d]),
  ...SERVER_DEFAULTS.map((d, i): [string, string, string] => [`servers.${i}`, `--chart-server-${i + 1}`, d]),
  ...PIE_DEFAULTS.map((d, i): [string, string, string] => [`pie.${i}`, `--chart-pie-${i + 1}`, d]),
];

// CSS colour names with their hex value (for comparing colours).
const NAMES = new Map(
  (
    "aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc bisque:ffe4c4 " +
    "black:000000 blanchedalmond:ffebcd blue:0000ff blueviolet:8a2be2 brown:a52a2a burlywood:deb887 " +
    "cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc " +
    "crimson:dc143c cyan:00ffff darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 " +
    "darkgreen:006400 darkgrey:a9a9a9 darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 " +
    "darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b " +
    "darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 " +
    "deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222 floralwhite:fffaf0 " +
    "forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 " +
    "green:008000 greenyellow:adff2f grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 " +
    "ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd " +
    "lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 " +
    "lightgreen:90ee90 lightgrey:d3d3d3 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa " +
    "lightskyblue:87cefa lightslategray:778899 lightslategrey:778899 lightsteelblue:b0c4de lightyellow:ffffe0 " +
    "lime:00ff00 limegreen:32cd32 linen:faf0e6 magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa " +
    "mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 mediumslateblue:7b68ee " +
    "mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa " +
    "mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 olivedrab:6b8e23 " +
    "orange:ffa500 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee " +
    "palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 " +
    "purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513 " +
    "salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb " +
    "slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f steelblue:4682b4 tan:d2b48c " +
    "teal:008080 thistle:d8bfd8 tomato:ff6347 turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff " +
    "whitesmoke:f5f5f5 yellow:ffff00 yellowgreen:9acd32 "
  )
    .trim()
    .split(" ")
    .map((p) => p.split(":") as [string, string]),
);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^(rgba?|hsla?)\(([^()]*)\)$/i;
const NUM = /^(?:\d{1,3}(?:\.\d{1,4})?|\.\d{1,4})(?:%|deg)?$/;

// A plain colour, normalised to lower case, else null.
export function chartColor(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 64) return null;
  const s = v.trim().toLowerCase();
  if (HEX.test(s) || NAMES.has(s) || s === "transparent") return s;
  const m = FUNC.exec(s);
  if (!m) return null;
  // rgb(1, 2, 3) / rgba(1, 2, 3, 0.5) / rgb(1 2 3 / 50%): three or four numbers.
  const parts = m[2].trim().split(/\s*[,/]\s*|\s+/);
  if (parts.length < 3 || parts.length > 4 || !parts.every((p) => NUM.test(p))) return null;
  return `${m[1]}(${parts.slice(0, 3).join(", ")}${parts[3] ? `, ${parts[3]}` : ""})`;
}

const MAX = { series: SERIES, servers: SERVERS, pie: PIES } as Record<string, number>;

// The valid entries of a parsed chart.json as [CSS variable, colour], and
// the keys that were set but dropped (for a server-side note).
export function chartVars(json: unknown): { vars: [string, string][]; dropped: string[] } {
  const vars: [string, string][] = [];
  const dropped: string[] = [];
  if (!json || typeof json !== "object" || Array.isArray(json)) return { vars, dropped };
  const root = json as Record<string, unknown>;
  for (const [key, cssVar] of CHART_KEYS) {
    const [a, b] = key.split(".");
    let v: unknown = root[a];
    if (b !== undefined) {
      if (MAX[a] !== undefined && !Array.isArray(v)) v = undefined;
      else if (v && typeof v === "object") v = (v as Record<string, unknown>)[b];
      else v = undefined;
    }
    if (v === undefined || v === null) continue;
    const c = chartColor(v);
    if (c) vars.push([cssVar, c]);
    else dropped.push(key);
  }
  for (const [a, max] of Object.entries(MAX)) {
    const arr = root[a];
    if (Array.isArray(arr) && arr.length > max) dropped.push(`${a}[${max}+]`);
  }
  return { vars, dropped };
}

// Colours that are shown together in one chart must differ: the total and
// the server lines, the series, players and uptime, points, gains and
// losses, the trend pills, the radar areas, the pie slices. Earlier groups
// win; a later colour that repeats one of its group is replaced.
const range = (k: string, n: number) => Array.from({ length: n }, (_, i) => `${k}.${i}`);
export const CHART_GROUPS: string[][] = [
  range("series", SERIES),
  ["series.0", ...range("servers", SERVERS)],
  ["series.1", "uptime"],
  ["series.0", "gain", "loss"],
  ["spark.total", "spark.current", "gain", "loss"],
  ["spark.totalLine", "spark.currentLine"],
  ["radar.total", "radar.current"],
  range("pie", PIES),
];

// Replacements for a repeated colour, the first one not used in the group.
const SPARE = ["#5aa9ff", "#4cc38a", "#ffd54f", "#b388ff", "#ff8a5c", "#4dd0e1", "#f48fb1", "#d64541", "#8bc34a", "#2f7dc0", "#c9a200", "#1aa0a0", "#d0609a", "#9e9e9e", "#ff8000", "#6b6b6b", "#ffffff", "#000000"];

// The theme variables the chart defaults use, as in the :root block of
// globals.css (used when theme.css does not set them).
export const BASE_THEME: Record<string, string> = { accent: "#ff8000", "series-2": "#5aa9ff", good: "#4cc38a", bad: "#ff4d4d" };

// The variables of a theme.css (the last one wins, as in CSS).
export function themeVars(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/--([a-z0-9-]{1,40})\s*:\s*([^;{}]{1,200});/g)) out.set(m[1], m[2].trim());
  return out;
}

// A plain colour as "r,g,b,a" (0-255, alpha 0-1), so #f00, #ff0000, red and
// rgb(255, 0, 0) compare equal; null if it is not a plain colour.
export function colorKey(v: string): string | null {
  const c = chartColor(v);
  if (!c) return null;
  if (c === "transparent") return "0,0,0,0";
  let hex = c.startsWith("#") ? c.slice(1) : NAMES.get(c);
  if (hex) {
    if (hex.length <= 4) hex = [...hex].map((x) => x + x).join("");
    const n = (i: number) => parseInt(hex!.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), hex.length === 8 ? +(n(6) / 255).toFixed(3) : 1].join(",");
  }
  const m = /^(rgba?|hsla?)\((.*)\)$/.exec(c)!;
  const p = m[2].split(", ");
  const num = (x: string, scale: number) => (x.endsWith("%") ? (parseFloat(x) / 100) * scale : parseFloat(x));
  const a = p[3] === undefined ? 1 : Math.min(1, num(p[3], 1));
  let rgb: number[];
  if (m[1].startsWith("rgb")) rgb = p.slice(0, 3).map((x) => num(x, 255));
  else {
    const h = (((parseFloat(p[0]) % 360) + 360) % 360) / 360;
    const sat = Math.min(1, num(p[1], 1));
    const l = Math.min(1, num(p[2], 1));
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
    const t = 2 * l - q;
    const f = (x: number) => {
      const k = x < 0 ? x + 1 : x > 1 ? x - 1 : x;
      return k < 1 / 6 ? t + (q - t) * 6 * k : k < 1 / 2 ? q : k < 2 / 3 ? t + (q - t) * (2 / 3 - k) * 6 : t;
    };
    rgb = [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((x) => x * 255);
  }
  return [...rgb.map((x) => Math.round(Math.min(255, x))), +a.toFixed(3)].join(",");
}

// A default such as var(--accent) or var(--series-3, #d64541) as the colour
// it stands for in this theme.
function resolve(fallback: string, theme: Map<string, string>): string {
  const m = /^var\(--([a-z0-9-]+)(?:,\s*(.+))?\)$/.exec(fallback);
  if (!m) return fallback;
  return chartColor(theme.get(m[1])) ?? BASE_THEME[m[1]] ?? chartColor(m[2]) ?? fallback;
}

// The colours of every key in CHART_GROUPS, from chart.json, else from the
// defaults resolved against theme.css, with repeats in a group replaced.
// replaced: the keys that got another colour.
export function uniqueColours(set: Map<string, string>, themeCss: string): { colours: Map<string, string>; replaced: string[] } {
  const theme = themeVars(themeCss);
  const byKey = new Map(CHART_KEYS.map(([key, cssVar, fallback]) => [key, set.get(cssVar) ?? resolve(fallback, theme)]));
  const done = new Set<string>();
  const replaced: string[] = [];
  const id = (key: string) => colorKey(byKey.get(key)!) ?? byKey.get(key)!;
  for (const group of CHART_GROUPS) {
    const used = new Set<string>();
    for (const key of group) if (done.has(key)) used.add(id(key));
    for (const [i, key] of group.entries()) {
      if (done.has(key)) continue;
      if (used.has(id(key))) {
        // Not a colour that a later key of the group still brings along.
        const later = new Set(group.slice(i + 1).map(id));
        const spare = SPARE.find((c) => !used.has(colorKey(c)!) && !later.has(colorKey(c)!))!;
        byKey.set(key, spare);
        used.add(colorKey(spare)!);
        replaced.push(key);
      } else used.add(id(key));
      done.add(key);
    }
  }
  return { colours: new Map([...done].map((k) => [k, byKey.get(k)!])), replaced };
}

// The CSS block for a template: every chart variable, from chart.json where
// it sets a valid colour, else the default. Written out in full so a game
// design always replaces the main template's chart colours. The colours of
// CHART_GROUPS are written as plain colours, kept unique per group.
export function chartCss(json: unknown, themeCss = ""): { css: string; dropped: string[]; replaced: string[] } {
  const { vars, dropped } = chartVars(json);
  const set = new Map(vars);
  const { colours, replaced } = uniqueColours(set, themeCss);
  const lines = CHART_KEYS.map(([key, cssVar, fallback]) => `  ${cssVar}: ${colours.get(key) ?? set.get(cssVar) ?? fallback};`);
  return { css: `\n/* chart colours (chart.json) */\nhtml[data-skin] {\n${lines.join("\n")}\n}\n`, dropped, replaced };
}
