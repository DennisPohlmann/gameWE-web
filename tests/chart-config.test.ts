// chart.json of the design templates: only plain colours get through, the
// defaults match globals.css and every built-in chart.json is valid. Run
// with `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { CHART_KEYS, chartColor, chartCss, chartVars } from "../src/lib/chart-config.ts";

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
  }
});
