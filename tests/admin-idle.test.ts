// Automatic sign-out of the admin area (src/lib/admin-idle.ts, lib/auth.ts,
// admin/session/route.ts, components/admin/idle-logout.tsx). Run with
// `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { IDLE_DEFAULT_MINUTES, idleLeft, idleMinutes, touchEvery } from "../src/lib/admin-idle.ts";
import { allSettings, settingGroups } from "../src/lib/admin-settings.ts";

test("on with 10 minutes by default; only 0 turns it off", () => {
  assert.equal(IDLE_DEFAULT_MINUTES, 10);
  assert.equal(idleMinutes(undefined, undefined), 10);
  assert.equal(idleMinutes("1", undefined), 10);
  assert.equal(idleMinutes("", ""), 10);
  assert.equal(idleMinutes("0", "30"), 0);
  assert.equal(idleMinutes(" 0 ", undefined), 0);
  assert.equal(idleMinutes("1", "30"), 30);
  assert.equal(idleMinutes(undefined, "1"), 1);
  assert.equal(idleMinutes(undefined, "1440"), 1440);
});

test("a broken time is the default, never off or endless", () => {
  for (const bad of ["0", "-5", "1441", "abc", "2.5", "1e9", "Infinity", "NaN"]) assert.equal(idleMinutes("1", bad), 10, bad);
});

test("time left from the last activity", () => {
  const now = 1_000_000_000;
  assert.equal(idleLeft(now, 10, now), 600_000);
  assert.equal(idleLeft(now - 599_999, 10, now), 1);
  assert.equal(idleLeft(now - 600_000, 10, now), 0);
  assert.equal(idleLeft(now - 3_600_000, 10, now), 0);
  // A time in the future counts as now, it never adds time.
  assert.equal(idleLeft(now + 3_600_000, 10, now), 600_000);
  assert.equal(idleLeft(Number.NaN, 10, now), 0);
  assert.equal(idleLeft(0, 0, now), Infinity);
});

test("activity reaches the server well before the time runs out", () => {
  assert.equal(touchEvery(10 * 60_000), 60_000);
  assert.equal(touchEvery(1440 * 60_000), 60_000);
  // One minute: renewed every 15 seconds, not only once a minute.
  assert.equal(touchEvery(60_000), 15_000);
  for (const m of [1, 2, 3, 5, 10, 60]) assert.ok(touchEvery(m * 60_000) <= (m * 60_000) / 4, String(m));
});

const idle = readFileSync("src/components/admin/idle-logout.tsx", "utf8");

test("the page reports activity not reported yet before the cookie's time runs out", () => {
  assert.match(idle, /const every = touchEvery\(limit\)/);
  // Not the activity of the same moment as the last report.
  assert.match(idle, /if \(last - touched > 1_000\) return report\(\);/);
  // The countdown follows the server once another tab kept the session.
  assert.match(idle, /if \(typeof left === "number"\) last = Date.now\(\) - limit \+ left;/);
  assert.match(idle, /schedule\(limit - every\)/);
  assert.doesNotMatch(idle, /IDLE_TOUCH_MS/);
});

test("its settings page is in its own admin area, level 100 only", () => {
  const g = settingGroups.find((x) => x.id === "admin");
  assert.ok(g);
  assert.equal(g.area, "admin");
  assert.deepEqual(
    g.items.map((s) => s.key),
    ["gamewe_admin_auto_logout", "gamewe_admin_logout_minutes"],
  );
  const on = allSettings.find((s) => s.key === "gamewe_admin_auto_logout")!;
  const min = allSettings.find((s) => s.key === "gamewe_admin_logout_minutes")!;
  assert.equal(on.def, "1");
  assert.equal(min.def, "10");
  assert.equal(on.minLevel, 100);
  assert.equal(min.minLevel, 100);
  const nav = readFileSync("src/components/admin/nav.tsx", "utf8");
  assert.match(nav, /groupLinks\("admin"/);
});

const auth = readFileSync("src/lib/auth.ts", "utf8");
const route = readFileSync("src/app/admin/session/route.ts", "utf8");
const layout = readFileSync("src/app/admin/(panel)/layout.tsx", "utf8");

test("the server refuses an idle session, not only the page", () => {
  const cur = auth.slice(auth.indexOf("export const currentAdmin"), auth.indexOf("export async function requireAdmin"));
  assert.match(cur, /idleLeft\(data\.a, \(await getSettings\(\)\)\.adminIdleMinutes, Date\.now\(\)\) <= 0\) return null/);
  // Renewing never revives an idle session and keeps the session's end.
  const touch = auth.slice(auth.indexOf("export async function touchSession"), auth.indexOf("export async function logout"));
  assert.match(touch, /<= 0\) return 0;/);
  assert.match(touch, /writeSession\(\{ \.\.\.s, a: now \}/);
});

test("the session route renews only same-origin posts", () => {
  assert.match(route, /export async function POST[\s\S]*sameOrigin\(/);
  assert.match(route, /status: 401/);
  assert.match(route, /"cache-control": "no-store"/);
});

test("every admin page runs the sign-out timer", () => {
  assert.match(layout, /<IdleLogout minutes=\{settings\.adminIdleMinutes\} base=\{basePath\} label=\{u\.idleIn\} \/>/);
});

test("the countdown in the top bar reads m:ss, rounded up", async () => {
  const { countdownText } = await import("../src/lib/admin-idle.ts");
  assert.equal(countdownText(600_000), "10:00");
  assert.equal(countdownText(59_001), "1:00");
  assert.equal(countdownText(59_000), "0:59");
  assert.equal(countdownText(1), "0:01");
  assert.equal(countdownText(0), "0:00");
  assert.equal(countdownText(-5), "0:00");
  assert.equal(countdownText(1440 * 60_000), "1440:00");
});
