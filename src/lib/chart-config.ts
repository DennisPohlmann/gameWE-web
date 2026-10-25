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
  ...SERIES_DEFAULTS.map((d, i): [string, string, string] => [`series.${i}`, `--chart-series-${i + 1}`, d]),
  ...SERVER_DEFAULTS.map((d, i): [string, string, string] => [`servers.${i}`, `--chart-server-${i + 1}`, d]),
  ...PIE_DEFAULTS.map((d, i): [string, string, string] => [`pie.${i}`, `--chart-pie-${i + 1}`, d]),
];

const NAMES = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue " +
    "chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey " +
    "darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray " +
    "darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen " +
    "fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki " +
    "lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen " +
    "lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime " +
    "limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue " +
    "mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive " +
    "olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum " +
    "powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver " +
    "skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white " +
    "whitesmoke yellow yellowgreen transparent"
  ).split(" "),
);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^(rgba?|hsla?)\(([^()]*)\)$/i;
const NUM = /^(?:\d{1,3}(?:\.\d{1,4})?|\.\d{1,4})(?:%|deg)?$/;

// A plain colour, normalised to lower case, else null.
export function chartColor(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 64) return null;
  const s = v.trim().toLowerCase();
  if (HEX.test(s) || NAMES.has(s)) return s;
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

// The CSS block for a template: every chart variable, from chart.json where
// it sets a valid colour, else the default. Written out in full so a game
// design always replaces the main template's chart colours.
export function chartCss(json: unknown): { css: string; dropped: string[] } {
  const { vars, dropped } = chartVars(json);
  const set = new Map(vars);
  const lines = CHART_KEYS.map(([, cssVar, fallback]) => `  ${cssVar}: ${set.get(cssVar) ?? fallback};`);
  return { css: `\n/* chart colours (chart.json) */\nhtml[data-skin] {\n${lines.join("\n")}\n}\n`, dropped };
}
