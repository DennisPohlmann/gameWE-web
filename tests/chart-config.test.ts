// chart.json of the design templates: only plain colours get through, the
// defaults match globals.css and every built-in chart.json is valid. Run
// with `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { BASE_THEME, CHART_GROUPS, CHART_KEYS, chartColor, chartCss, chartVars, colorKey } from "../src/lib/chart-config.ts";

test("plain colours are kept", () => {
  assert.equal(chartColor("#FF8000"), "#ff8000");
  assert.equal(chartColor("#abc"), "#abc");
  assert.equal(chartColor("#abcd"), "#abcd");
  assert.equal(chartColor("#11223344"), "#11223344");
  assert.equal(chartColor("rgb(1,2,3)"), "rgb(1, 2, 3)");
  assert.equal(chartColor("rgba(20, 20, 20, 0.92)"), "rgba(20, 20, 20, 0.92)");
  assert.equal(chartColor("rgb(10% 20% 30% / 50%)"), "rgb(10%, 20%, 30%, 50%)");
  assert.equal(chartColor("hsl(120deg, 50%, 40%)"), "hsl(120deg, 50%, 40%)");
  assert.equal(chartColor("hsla(120, 50%, 40%, .5)"), "hsla(120, 50%, 40%, .5)");
  assert.equal(chartColor(" RebeccaPurple "), "rebeccapurple");
  assert.equal(chartColor("transparent"), "transparent");
});

test("anything else is dropped", () => {
  for (const bad of [
    "red;}body{background:red",
    "red; --x: 1",
    "url(https://example.org/x.png)",
    "var(--accent)",
    "expression(alert(1))",
    "rgb(1,2,3);x",
    "rgb(1,2)",
    "rgb(1,2,3,4,5)",
    "rgb(calc(1),2,3)",
    "rgb(1,2,3) url(x)",
    "#12",
    "#12345",
    "#ggg",
    "notacolour",
    "currentcolor",
    "inherit",
    "linear-gradient(red, blue)",
    "red</style><script>",
    "/* */red",
    "\\72 ed",
    "",
    "#" + "f".repeat(100),
    12,
    null,
    ["red"],
    { a: "red" },
  ]) {
    assert.equal(chartColor(bad), null, String(bad));
  }
});

test("keys, nesting and array limits", () => {
  const { vars, dropped } = chartVars({
    grid: "#111",
    axis: "url(x)",
    tooltip: { background: "#222", text: "red;}" },
    series: ["#333", "var(--x)", "#444", "#5", "#6", "#7", "#8", "#9", "#a", "#b"],
    servers: "#fff",
    pie: { 0: "#fff" },
    unknown: "#000",
  });
  const m = new Map(vars);
  assert.equal(m.get("--chart-grid"), "#111");
  assert.equal(m.get("--chart-tip-bg"), "#222");
  assert.equal(m.get("--chart-series-1"), "#333");
  assert.equal(m.get("--chart-series-2"), undefined);
  assert.equal(m.get("--chart-series-3"), "#444");
  assert.equal(m.get("--chart-server-1"), undefined);
  assert.equal(m.get("--chart-pie-1"), undefined);
  assert.equal(m.has("--chart-axis"), false);
  assert.deepEqual(dropped.sort(), ["axis", "series.1", "series.3", "series.4", "series.5", "series.6", "series.7", "series[8+]", "tooltip.text"].sort());
  assert.deepEqual(chartVars("x").vars, []);
  assert.deepEqual(chartVars([1, 2]).vars, []);
});

test("the CSS block has every variable, set or default, and nothing else", () => {
  const { css } = chartCss({ grid: "#123456", axis: "red;}body{color:red" });
  const lines = css.split("\n").filter((l) => l.startsWith("  "));
  assert.equal(lines.length, CHART_KEYS.length);
  assert.ok(css.includes("--chart-grid: #123456;"));
  assert.ok(css.includes("--chart-axis: var(--muted);"));
  assert.ok(!css.includes("body"));
  assert.equal(css.match(/[{}]/g)?.length, 2);
});

test("globals.css has the same defaults", () => {
  const src = readFileSync("src/app/globals.css", "utf8");
  const block = /:root \{\n(  --chart-[\s\S]*?)\n\}/.exec(src)?.[1];
  assert.ok(block);
  assert.deepEqual(
    block.split("\n").map((l) => l.trim()),
    CHART_KEYS.map(([, v, d]) => `${v}: ${d};`),
  );
});

test("every built-in chart.json is valid", () => {
  for (const id of readdirSync("templates", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    let raw: string;
    try {
      raw = readFileSync(`templates/${id}/chart.json`, "utf8");
    } catch {
      continue;
    }
    const { vars, dropped } = chartVars(JSON.parse(raw));
    assert.deepEqual(dropped, [], id);
    assert.ok(vars.length > 20, id);
    // No repeats either, so the guard below never has to step in.
    assert.deepEqual(chartCss(JSON.parse(raw), readFileSync(`templates/${id}/theme.css`, "utf8")).replaced, [], id);
  }
});

// The colours of every group as written into the CSS block.
function groups(css: string): Map<string, string>[] {
  const v = new Map([...css.matchAll(/ (--chart-[a-z0-9-]+): ([^;]+);/g)].map((m) => [m[1], m[2]]));
  const cssVar = new Map(CHART_KEYS.map(([k, c]) => [k, c]));
  return CHART_GROUPS.map((g) => new Map(g.map((k) => [k, v.get(cssVar.get(k)!)!])));
}

function assertUnique(css: string, label: string) {
  for (const g of groups(css)) {
    const keys = [...g.values()].map((c) => colorKey(c));
    assert.ok(keys.every((k) => k !== null), `${label}: ${[...g.values()].join(" ")}`);
    assert.equal(new Set(keys).size, keys.length, `${label}: ${[...g.entries()].join(" ")}`);
  }
}

test("colours are normalised before they are compared", () => {
  for (const c of ["#f00", "#FF0000", "#ff0000ff", "red", "rgb(255, 0, 0)", "rgb(100% 0% 0%)", "hsl(0, 100%, 50%)", "hsla(360deg, 100%, 50%, 1)"]) {
    assert.equal(colorKey(c), "255,0,0,1", c);
  }
  assert.equal(colorKey("green"), colorKey("hsl(120deg 100% 25.1%)"));
  assert.notEqual(colorKey("rgba(255, 0, 0, 0.5)"), colorKey("red"));
  assert.equal(colorKey("transparent"), "0,0,0,0");
  assert.equal(colorKey("var(--accent)"), null);
});

test("a repeated colour in chart.json is replaced, the first one stays", () => {
  const { css, replaced } = chartCss({ series: ["#ff4fa3", "#5aa9ff"], servers: ["#FF4FA3", "#5aa9ff", "#4cc38a"] });
  assert.deepEqual(replaced, ["servers.0"]);
  assert.ok(css.includes("--chart-series-1: #ff4fa3;"));
  assert.ok(!css.includes("--chart-server-1: #ff4fa3;"));
  // The replacement is none of the colours the group still uses.
  assert.ok(css.includes("--chart-server-2: #5aa9ff;"));
  assert.ok(css.includes("--chart-server-3: #4cc38a;"));
  assertUnique(css, "json");
  // Same input, same output.
  assert.equal(chartCss({ series: ["#ff4fa3"], servers: ["#ff4fa3"] }).css, chartCss({ series: ["#ff4fa3"], servers: ["#ff4fa3"] }).css);
});

test("a repeat through the theme.css defaults is replaced too", () => {
  // Total = --accent, first server set to the same colour as a name.
  const theme = "html[data-skin] { --accent: #ff0000; --series-2: #00f; --good: lime; --bad: rgb(255, 0, 0); }";
  const { css, replaced } = chartCss({ servers: ["red"], uptime: "blue" }, theme);
  assert.deepEqual(replaced.sort(), ["loss", "servers.0", "uptime"].sort());
  assert.ok(css.includes("--chart-series-1: #ff0000;"));
  assert.ok(css.includes("--chart-series-2: #00f;"));
  assertUnique(css, "theme");
});

test("other duplicates: pie, players and uptime, trend pills, radar", () => {
  const { replaced, css } = chartCss({
    pie: ["#111111", "#111", "#222222"],
    series: ["#333333", "#444444"],
    uptime: "#444",
    spark: { total: "#555555", current: "#555555", totalLine: "#666", currentLine: "#666666" },
    radar: { total: "#777777", current: "#777" },
  });
  assert.deepEqual(replaced.sort(), ["pie.1", "radar.current", "spark.current", "spark.currentLine", "uptime"].sort());
  assertUnique(css, "groups");
});

test("the defaults without template and the base theme match globals.css", () => {
  const src = readFileSync("src/app/globals.css", "utf8");
  for (const [k, v] of Object.entries(BASE_THEME)) assert.ok(src.includes(`  --${k}: ${v};`), k);
  const { css, replaced } = chartCss(null, "");
  assert.deepEqual(replaced, []);
  assertUnique(css, "defaults");
});

test("every built-in template and a template without chart.json resolve without repeats", () => {
  for (const id of readdirSync("templates", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const theme = readFileSync(`templates/${id}/theme.css`, "utf8");
    let json: unknown = null;
    try {
      json = JSON.parse(readFileSync(`templates/${id}/chart.json`, "utf8"));
    } catch {
      json = null;
    }
    assertUnique(chartCss(json, theme).css, id);
    assertUnique(chartCss(null, theme).css, `${id} without chart.json`);
  }
});
