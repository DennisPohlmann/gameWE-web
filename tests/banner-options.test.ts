// Layout, background and language of the banner pictures.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BACKGROUNDS, backgroundLayer, bannerChoices, bannerOptions, fitSize, imageLang, optionsKey, sizePx, tint } from "../src/lib/banners/options.ts";
import { textWidth } from "../src/lib/banners/text-width.ts";

const opts = (kind: "player" | "server" | "voice", path: string) => bannerOptions(kind, new URL(`http://x${path}`));

test("the language is the folder right before the file, else ?lang=, else English", () => {
  assert.equal(opts("player", "/banner/css/player/de/12.png").lang, "de");
  assert.equal(opts("player", "/sig/ru/12-dark.png").lang, "ru");
  assert.equal(opts("voice", "/banner/pt-br/teamspeak.png").lang, "pt-br");
  assert.equal(opts("player", "/banner/css/player/12.png?lang=fr").lang, "fr");
  assert.equal(opts("player", "/api/v1/players/12/banner?lang=nl").lang, "nl");
  assert.equal(opts("player", "/banner/css/player/12.png").lang, "en");
  assert.equal(opts("server", "/banner/css/server/xx/1.png?lang=yy").lang, "en");
});

test("unknown layouts and backgrounds give the defaults; D only for players", () => {
  assert.deepEqual(opts("player", "/sig/12.png?layout=d&bg=dots"), { lang: "en", layout: "d", bg: "dots", size: "normal", html: false });
  assert.equal(opts("server", "/banner/css/server/1.png?layout=d").layout, "a");
  assert.equal(opts("voice", "/banner/teamspeak.png?layout=c").layout, "c");
  assert.equal(opts("player", "/sig/12.png?bg=url(evil)").bg, "plain");
  assert.equal(optionsKey(opts("player", "/sig/de/12.png?layout=b&bg=grid")), "de|b|grid|normal");
});

test("Chinese gets the English texts (no CJK font)", () => {
  assert.equal(imageLang("zh-cn"), "en");
  assert.equal(imageLang("zh-tw"), "en");
  assert.equal(imageLang("ru"), "ru");
});

test("patterns only use plain colours with transparency", () => {
  assert.equal(tint("#fff", 0.5), "rgba(255,255,255,0.5)");
  assert.equal(tint("#ff8000", 0.1), "rgba(255,128,0,0.1)");
  assert.equal(tint("rgb(1, 2, 3)", 0.2), "rgba(1,2,3,0.2)");
  assert.equal(tint("white", 0.2), "rgba(128,128,128,0.2)");
  assert.equal(backgroundLayer("plain", "#fff", "#f80"), null);
  for (const bg of BACKGROUNDS.filter((b) => b !== "plain")) assert.match(backgroundLayer(bg, "#ffffff", "#ff8000")?.backgroundImage ?? "", /gradient\(/);
});

test("the code box lists every layout and background with its name", () => {
  const t = { bannerLayouts: { a: "Clear", b: "Card", c: "Badge", d: "Trend" }, bannerBackgrounds: { plain: "Plain", dots: "Dots" }, bannerSizes: { normal: "Normal", small: "Small" } };
  const c = bannerChoices("server", t);
  assert.deepEqual(c.layouts.map((l) => l.id), ["a", "b", "c", "e", "f"]);
  assert.deepEqual(bannerChoices("voice", t).layouts.map((l) => l.id), ["a", "b", "c", "e"]);
  assert.deepEqual(bannerChoices("player", t).layouts.map((l) => l.id), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(c.tallLayouts, ["e"]);
  assert.deepEqual(bannerChoices("voice", t).tallLayouts, ["a", "e"]);
  assert.equal(c.backgrounds[1].name, "Dots");
  assert.equal(c.backgrounds[2].name, "grid");
  assert.deepEqual(c.sizes.map((x) => [x.name, x.width, x.height]), [["Normal (560×95)", 560, 95], ["Small (350×20)", 350, 20], ["tall (160×400)", 160, 400]]);
});

test("fitSize: the TeamSpeak address keeps its size while it fits, else shrinks, never below 6", () => {
  assert.equal(fitSize("ts.example.org", 250, 13), 13);
  assert.equal(fitSize("ts.example-gaming-community.de:9987", 250, 13), 12.5);
  const long = fitSize("teamspeak.example-gaming-community-network.de:9987", 250, 13);
  assert.ok(long < 12 && long >= 6 && textWidth("teamspeak.example-gaming-community-network.de:9987", long) <= 250, String(long));
  assert.equal(fitSize("x".repeat(100), 250, 13), 6);
});

test("sizes: small and tall ignore the layout, unknown sizes are the normal one", () => {
  // The tall server banner is only the side strip, also for old ?layout=a URLs.
  assert.deepEqual(opts("server", "/banner/css/server/1.png?size=tall&layout=a"), { lang: "en", layout: "e", bg: "plain", size: "tall", html: false });
  assert.equal(opts("server", "/banner/css/server/1.html").layout, "e");
  assert.equal(opts("player", "/banner/css/player/1.png?size=tall&layout=c").layout, "a");
  // The tall size has layout e (side strip) besides the default.
  assert.deepEqual(opts("player", "/banner/css/player/12.html?layout=e"), { lang: "en", layout: "e", bg: "plain", size: "tall", html: true });
  assert.equal(opts("voice", "/banner/teamspeak.png?size=small&layout=e").layout, "a");
  assert.deepEqual(opts("player", "/banner/css/player/de/12-dark.html?size=small&layout=b"), { lang: "de", layout: "a", bg: "plain", size: "small", html: true });
  assert.deepEqual(opts("player", "/banner/css/player/de/12-dark.html?layout=b"), { lang: "de", layout: "a", bg: "plain", size: "tall", html: true });
  assert.deepEqual(opts("server", "/banner/css/server/1.html?size=normal&layout=c"), { lang: "en", layout: "c", bg: "plain", size: "normal", html: true });
  assert.equal(optionsKey(opts("voice", "/banner/teamspeak.html")), "en|a|plain|tall|html");
  assert.equal(opts("player", "/sig/12.png?size=huge").size, "normal");
  assert.deepEqual(sizePx("player", "normal"), [400, 100]);
  assert.deepEqual(sizePx("voice", "normal"), [560, 95]);
  assert.deepEqual(sizePx("voice", "small"), [350, 20]);
  assert.deepEqual(sizePx("player", "tall"), [160, 400]);
});
