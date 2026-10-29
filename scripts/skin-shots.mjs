// Screenshots of the public pages in the six built-in skins, desktop and
// phone, from one running server in one browser: every skin x device pair is
// its own browser context and they run side by side. The skin comes from the
// preview cookie (src/lib/skin-preview.ts), so the server must run with
// SKIN_PREVIEW=on; nothing in the database changes and there is no waiting
// for the settings cache.
//
//   SKIN_PREVIEW=on npm start                       (or npm run dev)
//   node scripts/skin-shots.mjs                      every page of PAGES
//   node scripts/skin-shots.mjs -pages player,server only these pages
//   node scripts/skin-shots.mjs -out shots/after -baseline shots/before
//
// Options (all optional):
//   -base URL       the running site, with BASE_PATH (default http://localhost:3000)
//   -out DIR        where the PNGs go (default shots/<date-time>)
//   -pages a,b      names from PAGES, or own paths starting with / ({game},
//                   {player}, {server}, {clan}, {map}, {weapon} are filled in)
//   -skins a,b      default: the six of SKINS
//   -devices a,b    desktop, phone (default both)
//   -game CODE      ranking for {game} (default: the first one of the home page)
//   -height PX      cut long pages after this many CSS pixels (default 3000, 0 = whole page)
//   -baseline DIR   compare with the PNGs of an earlier run: report.txt lists
//                   only what changed, diff/ shows where
//   -min N          fewer changed pixels than this count as unchanged (default
//                   100: anti-aliasing noise)
//   -consent V      cookie consent: "1." only necessary (default, no map tiles
//                   or avatars from other hosts), "1.maps-steam" all, "none"
//                   shows the banner
//   -jobs N         contexts at the same time (default 6)
//   -sheet          also a contact sheet per page and device (sheet/), one
//                   small picture of all skins to look at instead of six
//
// Needs Playwright with Chromium (not a dependency of the site):
//   npm i --no-save playwright && npx playwright install chromium
// sharp (devDependency) compares the pictures and builds the sheets.
// report.txt lists per shot: HTTP status, horizontal overflow (the page wider
// than the screen), browser errors and, with -baseline, the changed share.
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SKINS = ["dark", "light", "orange", "modern-dark", "modern-light", "modern-orange"];
export const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
// The fixed page list: name -> path. Placeholders are found on the site.
export const PAGES = {
  home: "/",
  ranking: "/{game}",
  players: "/{game}/players",
  player: "/{game}/players/{player}",
  server: "/{game}/servers/{server}",
  clans: "/{game}/clans",
  clan: "/{game}/clans/{clan}",
  maps: "/{game}/maps",
  map: "/{game}/maps/{map}",
  weapons: "/{game}/weapons",
  awards: "/{game}/awards",
  misc: "/{game}/misc",
};
const COOKIE = "gamewe_skin_preview";
const CONSENT = "gamewe_consent"; // src/lib/consent.ts

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--?/, "");
    if (k === "sheet") o.sheet = true;
    else o[k] = argv[++i];
  }
  return o;
}

const list = (v, all) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : all);

// First link on a page whose path matches re (group 1 = the id).
async function firstId(page, url, re, skip = []) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
  for (const h of hrefs) {
    const m = re.exec(h.split(/[?#]/)[0]);
    if (m && !skip.includes(m[1])) return m[1];
  }
  return null;
}
// Top-level pages that are no ranking.
const NOT_GAMES = ["admin", "api", "help", "licenses", "privacy", "search", "voice", "sig", "theme"];

async function placeholders(browser, base, game) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const basePath = new URL(base).pathname.replace(/\/$/, "");
  const esc = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const v = { game };
  if (!v.game) v.game = await firstId(page, `${base}/`, new RegExp(`^${esc}/([a-z0-9_-]+)$`), NOT_GAMES);
  if (!v.game) throw new Error(`no ranking found on ${base}/; start the site with data or pass -game`);
  const g = `${base}/${v.game}`;
  const re = (part) => new RegExp(`^${esc}/${v.game}/${part}/([^/]+)$`);
  v.player = await firstId(page, `${g}/players`, re("players"));
  v.server = await firstId(page, g, re("servers"));
  v.clan = await firstId(page, `${g}/clans`, re("clans"));
  v.map = await firstId(page, `${g}/maps`, re("maps"));
  v.weapon = await firstId(page, `${g}/weapons`, re("weapons"));
  await ctx.close();
  return v;
}

// Takes the next job off the shared queue until it is empty.
async function worker(browser, base, queue, out, height, consent, results) {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const { skin, device, pages } = job;
    const ctx = await browser.newContext({ ...DEVICES[device], reducedMotion: "reduce" });
    await ctx.addCookies([{ name: COOKIE, value: skin, url: base }, ...(consent === "none" ? [] : [{ name: CONSENT, value: consent, url: base }])]);
    const page = await ctx.newPage();
    let errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    for (const [name, p] of pages) {
      errors = [];
      const file = `${name}-${skin}-${device}.png`;
      const t0 = Date.now();
      let status = 0;
      try {
        const res = await page.goto(base + p, { waitUntil: "load", timeout: 60_000 });
        status = res?.status() ?? 0;
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
        await page.evaluate(() => document.fonts.ready);
        const got = await page.evaluate(() => document.documentElement.dataset.skin);
        if (got !== skin) errors.unshift(`skin is "${got}", not "${skin}": is the server running with SKIN_PREVIEW=on?`);
        const m = await page.evaluate(() => ({ w: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
        const h = height > 0 ? Math.min(m.h, height) : m.h;
        await page.screenshot({ path: path.join(out, file), fullPage: true, clip: { x: 0, y: 0, width: m.w, height: h } });
        results.push({ file, name, skin, device, status, overflow: m.sw > m.w ? m.sw - m.w : 0, errors, ms: Date.now() - t0 });
      } catch (e) {
        results.push({ file, name, skin, device, status, overflow: 0, errors: [String(e.message ?? e).split("\n")[0], ...errors], ms: Date.now() - t0, failed: true });
      }
    }
    await ctx.close();
  }
}

// Share of pixels that differ (any channel by more than 24 of 255), the box
// around them and a diff picture: the new shot dimmed, changes in red.
async function compare(sharp, a, b, diffFile) {
  const [A, B] = await Promise.all([a, b].map((f) => sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
    return { pixels: Infinity, share: 1, note: `size ${B.info.width}x${B.info.height} -> ${A.info.width}x${A.info.height}` };
  }
  const { width, height } = A.info;
  const out = Buffer.alloc(width * height * 4);
  let n = 0, x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let i = 0, px = 0; i < A.data.length; i += 4, px++) {
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    if (d > 24) {
      n++;
      const x = px % width, y = (px / width) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      out[i] = 255; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 255;
    } else {
      const g = (A.data[i] + A.data[i + 1] + A.data[i + 2]) / 12 + 160;
      out[i] = out[i + 1] = out[i + 2] = g; out[i + 3] = 255;
    }
  }
  if (n) await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(diffFile);
  return { pixels: n, share: n / (width * height), box: n ? `${x0},${y0}..${x1},${y1}` : "" };
}

// One picture per page and device with every skin side by side, labelled.
async function sheet(sharp, out, name, device, skins) {
  const w = device === "phone" ? 390 : 720;
  const tiles = [];
  for (const skin of skins) {
    const f = path.join(out, `${name}-${skin}-${device}.png`);
    if (!existsSync(f)) continue;
    const img = await sharp(f).resize({ width: w }).png().toBuffer({ resolveWithObject: true });
    tiles.push({ skin, img });
  }
  if (!tiles.length) return;
  const cols = device === "phone" ? 6 : 3;
  const label = 28;
  const rows = Math.ceil(tiles.length / cols);
  const rowH = [];
  for (let r = 0; r < rows; r++) rowH.push(Math.max(...tiles.slice(r * cols, r * cols + cols).map((t) => t.img.info.height)) + label);
  const composite = [];
  tiles.forEach((t, i) => {
    const left = (i % cols) * (w + 8);
    const top = rowH.slice(0, (i / cols) | 0).reduce((s, h) => s + h + 8, 0);
    composite.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${label}"><rect width="100%" height="100%" fill="#222"/><text x="8" y="19" font-family="sans-serif" font-size="16" fill="#fff">${t.skin}</text></svg>`), left, top });
    composite.push({ input: t.img.data, left, top: top + label });
  });
  const width = cols * (w + 8) - 8;
  const height = rowH.reduce((s, h) => s + h + 8, 0) - 8;
  mkdirSync(path.join(out, "sheet"), { recursive: true });
  await sharp({ create: { width, height, channels: 3, background: "#888" } }).composite(composite).png().toFile(path.join(out, "sheet", `${name}-${device}.png`));
}

async function main() {
  const o = args(process.argv.slice(2));
  const base = (o.base ?? "http://localhost:3000").replace(/\/$/, "");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const out = o.out ?? path.join("shots", stamp);
  const skins = list(o.skins, SKINS);
  const devices = list(o.devices, Object.keys(DEVICES));
  const height = o.height === undefined ? 3000 : Number(o.height);
  const jobs = Math.max(1, Number(o.jobs ?? 6));
  for (const d of devices) if (!DEVICES[d]) throw new Error(`unknown device ${d}`);

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("Playwright is missing: npm i --no-save playwright && npx playwright install chromium");
    process.exit(2);
  }
  mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  const browser = await chromium.launch();
  const tBrowser = Date.now() - t0;
  const wanted = list(o.pages, Object.keys(PAGES));
  const needs = wanted.some((p) => (PAGES[p] ?? p).includes("{"));
  const v = needs ? await placeholders(browser, base, o.game) : {};
  const pages = [];
  for (const p of wanted) {
    if (!PAGES[p] && !p.startsWith("/")) throw new Error(`unknown page ${p}; known: ${Object.keys(PAGES).join(", ")}`);
    const raw = PAGES[p] ?? p;
    const missing = [...raw.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => !v[k]);
    if (missing.length) {
      console.warn(`skip ${p}: no ${missing.join(", ")} found on the site`);
      continue;
    }
    const name = PAGES[p] ? p : raw.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
    pages.push([name, raw.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(v[k]))]);
  }
  const tFind = Date.now() - t0 - tBrowser;

  const queue = skins.flatMap((skin) => devices.map((device) => ({ skin, device, pages })));
  const results = [];
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, () => worker(browser, base, queue, out, height, o.consent ?? "1.", results)));
  await browser.close();
  const tShots = Date.now() - t0 - tBrowser - tFind;

  const sharp = o.baseline || o.sheet ? (await import("sharp")).default : null;
  if (o.baseline) {
    mkdirSync(path.join(out, "diff"), { recursive: true });
    for (const r of results) {
      const old = path.join(o.baseline, r.file);
      if (r.failed) continue;
      if (!existsSync(old)) r.change = { pixels: Infinity, share: 1, note: "new" };
      else r.change = await compare(sharp, path.join(out, r.file), old, path.join(out, "diff", r.file));
    }
  }
  if (o.sheet) for (const [name] of pages) for (const d of devices) await sheet(sharp, out, name, d, skins);
  const tAfter = Date.now() - t0 - tBrowser - tFind - tShots;

  results.sort((a, b) => a.file.localeCompare(b.file));
  const problems = results.filter((r) => r.failed || r.status >= 400 || r.overflow || r.errors.length);
  const minPixels = Number(o.min ?? 100);
  const changed = results.filter((r) => r.change && r.change.pixels >= minPixels);
  const lines = [
    `${results.length} shots of ${pages.length} pages x ${skins.length} skins x ${devices.length} devices in ${((Date.now() - t0) / 1000).toFixed(1)} s ` +
      `(browser ${(tBrowser / 1000).toFixed(1)} s, find ids ${(tFind / 1000).toFixed(1)} s, shots ${(tShots / 1000).toFixed(1)} s, compare/sheets ${(tAfter / 1000).toFixed(1)} s)`,
    `pages: ${pages.map(([n, p]) => `${n}=${p}`).join(" ")}`,
    "",
    problems.length ? `PROBLEMS (${problems.length}):` : "problems: none (all HTTP < 400, no horizontal overflow, no browser errors)",
    ...problems.map((r) => `  ${r.file}: ${[r.status >= 400 || r.failed ? `HTTP ${r.status}` : "", r.overflow ? `${r.overflow}px wider than the screen` : "", ...r.errors].filter(Boolean).join("; ")}`),
  ];
  if (o.baseline) {
    lines.push("", changed.length ? `CHANGED against ${o.baseline} (${changed.length} of ${results.length}, look at these and diff/):` : `unchanged against ${o.baseline}: all ${results.length} shots`);
    for (const r of changed) lines.push(`  ${r.file}: ${r.change.note ?? `${r.change.pixels} pixels (${(r.change.share * 100).toFixed(2)} %), area ${r.change.box}`}`);
  }
  const text = lines.join("\n") + "\n";
  writeFileSync(path.join(out, "report.txt"), text);
  writeFileSync(path.join(out, "report.json"), JSON.stringify({ base, pages, skins, devices, results }, null, 1));
  process.stdout.write(text + `\n-> ${out}\n`);
  process.exitCode = problems.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(2);
});
