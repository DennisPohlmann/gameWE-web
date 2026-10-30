// Game icons before the server names: every base game of games.ts has
// public/games/<code>/icon.png (a PNG of at least 32 x 32 px) and a
// LICENSE.txt that names source and license, and only known games get an
// icon URL. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { GAME_ICON_CREDITS, isOwnDrawing } from "../src/lib/game-icon-credits.ts";
import { gameIconSrc } from "../src/lib/game-icons.ts";
import { GAME_KINDS } from "../src/lib/games.ts";

const dir = "public/games";

test("every game has an icon of at least 32 x 32 px and a license file", () => {
  for (const code of Object.keys(GAME_KINDS)) {
    const png = readFileSync(`${dir}/${code}/icon.png`);
    assert.equal(png.subarray(1, 4).toString("latin1"), "PNG", `${code}: not a PNG`);
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    assert.ok(w >= 32 && h >= 32 && w === h, `${code}: ${w} x ${h}`);
    const license = readFileSync(`${dir}/${code}/LICENSE.txt`, "utf8");
    assert.match(license, /^Source: /m, `${code}: no source`);
    assert.match(license, /^License: /m, `${code}: no license`);
  }
});

test("no icon folder without a game", () => {
  for (const code of readdirSync(dir)) assert.ok(Object.hasOwn(GAME_KINDS, code), `public/games/${code} is no game of games.ts`);
});

test("the image credits (/licenses, THIRD-PARTY-LICENSES.md) match every LICENSE.txt", () => {
  const md = readFileSync("THIRD-PARTY-LICENSES.md", "utf8");
  assert.deepEqual(Object.keys(GAME_ICON_CREDITS).sort(), readdirSync(dir).sort());
  for (const [code, c] of Object.entries(GAME_ICON_CREDITS)) {
    const license = readFileSync(`${dir}/${code}/LICENSE.txt`, "utf8");
    assert.equal(license.match(/^Author: +(.+?)(?: \(presumably\))?$/m)?.[1], c.holder, `${code}: rights holder`);
    assert.match(license, isOwnDrawing(c) ? /^License: GPL-3\.0-or-later/m : /^License: UNKNOWN/m, `${code}: license`);
    assert.ok(md.includes(`| ${GAME_KINDS[code].name} | \`public/games/${code}/\` | `), `${code} missing in THIRD-PARTY-LICENSES.md`);
  }
});

test("only known games get an icon URL", () => {
  assert.equal(gameIconSrc("css"), "/games/css/icon.png");
  assert.equal(gameIconSrc(" CS2 "), "/games/cs2/icon.png");
  for (const g of [null, undefined, "", "unknown", "../flags", "constructor", "__proto__"]) assert.equal(gameIconSrc(g), null);
});
