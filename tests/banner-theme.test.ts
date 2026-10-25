// Banner colours of the design templates (player banner, server banner).
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { bannerTheme, BANNER_VARS, chosenTemplate, cssVars, darkBanner, hasBannerDefinition, parseImageFile } from "../src/lib/banner-theme.ts";

// npm test runs in the repository root.
const dir = path.join(process.cwd(), "templates");
const builtIn = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const css = (id: string) => readFileSync(path.join(dir, id, "theme.css"), "utf8");

test("every built-in template defines its banner completely and validly", () => {
  for (const id of builtIn) {
    const v = cssVars(css(id));
    assert.ok(hasBannerDefinition(css(id)), id);
    const th = bannerTheme(css(id));
    for (const [name, field] of BANNER_VARS) assert.equal(th[field], v.get(`banner-${name}`), `${id} --banner-${name}`);
  }
});

test("the Dark fallback is the banner of templates/dark", () => {
  assert.deepEqual(bannerTheme(css("dark")), darkBanner());
});

test("a template without banner definition gets the Dark banner", () => {
  const plain = "html[data-skin] { --surface: #ff00ff; --accent: #00ff00; --text: #000000; }";
  assert.equal(hasBannerDefinition(plain), false);
  assert.deepEqual(bannerTheme(plain), darkBanner());
  assert.deepEqual(bannerTheme(null), darkBanner());
});

test("a partial definition keeps the Dark banner for the rest", () => {
  const th = bannerTheme("html[data-skin] { --banner-accent: #ff69b4; --banner-stripe: none; }");
  assert.deepEqual(th, { ...darkBanner(), accent: "#ff69b4", stripe: null });
});

test("only plain colours and colour gradients are taken", () => {
  const bad = [
    "url(https://example.com/x.png)",
    "var(--accent)",
    "linear-gradient(180deg, url(x) 0%, #000 100%)",
    "linear-gradient(#000, #fff), linear-gradient(#000, #fff), linear-gradient(#000, #fff), linear-gradient(#000, #fff)",
    "linear-gradient(#000, #fff",
    "expression(alert(1))",
  ];
  for (const x of bad) assert.deepEqual(bannerTheme(`html[data-skin] { --banner-bg: ${x}; --banner-text: ${x}; }`), darkBanner(), x);
  const ok = bannerTheme("html[data-skin] { --banner-bg: linear-gradient(90deg, rgba(1,2,3,0.5) 0%, #ff69b4 100%); --banner-side: #101010; }");
  assert.equal(ok.bg, "linear-gradient(90deg, rgba(1,2,3,0.5) 0%, #ff69b4 100%)");
  assert.equal(ok.side, "#101010");
});

test("no style, classic and unknown styles mean the active skin", () => {
  for (const s of [null, "classic", "nope", "../dark", "Dark"]) assert.equal(chosenTemplate(s, builtIn), null, String(s));
  assert.equal(chosenTemplate("blue", builtIn), "blue");
  assert.deepEqual(parseImageFile("12-classic.png"), { id: 12, style: "classic" });
  assert.deepEqual(parseImageFile("12.png"), { id: 12, style: null });
  assert.equal(parseImageFile("12-../x.png"), null);
});
