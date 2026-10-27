// Map overviews under the heatmap: calibration files, picture sizes, file
// names and the built-in calibrations (src/lib/overview-format.ts). Run with
// `npm test`.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { LEVEL_SPLITS } from "../src/lib/map-levels.ts";
import { imageInfo, insideShare, overviewFile, overviewFrame, parseCalibration, parseKeyValues, shiftFrame } from "../src/lib/overview-format.ts";

const NUKE = `// HLTV overview description file for de_nuke.bsp

"de_nuke"
{
	"material"	"overviews/de_nuke"	// texture file
	"pos_x"		"-3453"	// upper left world coordinate
	"pos_y"		"2887"
	"scale"		"7"

	"verticalsections"
	{
		"default" // use the primary radar image
		{
			"AltitudeMax" "10000"
			"AltitudeMin" "-495"
		}
		"lower" // i.e. de_nuke_lower_radar.dds
		{
			"AltitudeMax" "-495"
			"AltitudeMin" "-10000"
		}
	}
}
`;

test("Valve overview files give position, scale and the lower level", () => {
  assert.deepEqual(parseCalibration(NUKE, "txt"), { posX: -3453, posY: 2887, scale: 7, ref: 1024, lowerSplit: -495, lowerShift: null });
  assert.deepEqual(parseCalibration('"de_dust2" { "pos_x" "-2476" "pos_y" "3239" "scale" "4.4" "rotate" "1" }', "txt"), {
    posX: -2476,
    posY: 3239,
    scale: 4.4,
    ref: 1024,
    lowerSplit: null,
    lowerShift: null,
  });
});

test("JSON calibrations, with ref and lower_split", () => {
  assert.deepEqual(parseCalibration('{"pos_x": -100, "pos_y": 200, "scale": 2, "ref": 2048, "lower_split": -50}', "json"), {
    posX: -100,
    posY: 200,
    scale: 2,
    ref: 2048,
    lowerSplit: -50,
    lowerShift: null,
  });
});

test("a lower level drawn elsewhere on the picture moves the picture", () => {
  const c = parseCalibration('{"pos_x": -3290, "pos_y": 1157.52, "scale": 6.98, "lower_offset": {"x": 0, "y": -46}}', "json")!;
  assert.deepEqual(c.lowerShift, { x: 0, y: -46 });
  const f = overviewFrame(c, { width: 2048, height: 2048 });
  const s = shiftFrame(f, c.lowerShift!);
  assert.equal(s.x, f.x);
  assert.ok(Math.abs(s.y - (f.y + 0.46 * f.height)) < 1e-9);
  assert.equal(parseCalibration('{"pos_x": 1, "pos_y": 1, "scale": 1, "lower_offset": {"x": 0, "y": 500}}', "json")?.lowerShift, null);
});

test("broken or incomplete calibrations are refused", () => {
  for (const [t, k] of [
    ['"de_x" { "pos_x" "1" "pos_y" "2" }', "txt"],
    ['"de_x" { "pos_x" "1" "pos_y" "2" "scale" "0" }', "txt"],
    ['"de_x" { "pos_x" "a" "pos_y" "2" "scale" "1" }', "txt"],
    ['"de_x" { "pos_x" "1"', "txt"],
    ['"de_x" { "pos_x', "txt"],
    ['"zoom" "1.7"', "txt"],
    ["[1, 2, 3]", "json"],
    ["{", "json"],
    ['{"pos_x": 1, "pos_y": 2, "scale": 1, "ref": 1}', "json"],
  ] as const)
    assert.equal(parseCalibration(t, k), null, t);
  assert.equal(parseKeyValues("{".repeat(20) + "}".repeat(20)), null);
  assert.equal(parseKeyValues("x".repeat(70000)), null);
});

test("the picture lies at pos_x/pos_y, 1024 pixels cover 1024 * scale units", () => {
  const c = parseCalibration('{"pos_x": -2476, "pos_y": 3239, "scale": 4.4}', "json")!;
  assert.deepEqual(overviewFrame(c, { width: 2048, height: 2048 }), { x: -2476, y: 3239, width: 4505.6, height: 4505.6 });
  assert.deepEqual(overviewFrame(c, { width: 1024, height: 512 }), { x: -2476, y: 3239, width: 4505.6, height: 2252.8 });
  const f = overviewFrame(c, { width: 1024, height: 1024 });
  assert.equal(insideShare(f, [[0, 0], [-2476, 3239], [2029, -1266]]), 1);
  assert.equal(insideShare(f, [[0, 0], [5000, 0], [0, 5000], [-5000, 0]]), 0.25);
  assert.equal(insideShare(f, []), 1);
});

function png(w: number, h: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}

test("picture type and size from the content", () => {
  assert.deepEqual(imageInfo(png(1024, 768)), { type: "image/png", width: 1024, height: 768 });
  // JPEG: SOI, an APP0 segment, then SOF0 with height 300 and width 400.
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x01, 0x2c, 0x01, 0x90, 3, 0, 0, 0]);
  assert.deepEqual(imageInfo(jpg), { type: "image/jpeg", width: 400, height: 300 });
  // WebP VP8X with a canvas of 1024 x 512.
  const webp = new Uint8Array(30);
  webp.set([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8X"), 10, 0, 0, 0, 0, 0, 0, 0, 0xff, 0x03, 0, 0xff, 0x01, 0]);
  assert.deepEqual(imageInfo(webp), { type: "image/webp", width: 1024, height: 512 });
  assert.equal(imageInfo(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
  assert.equal(imageInfo(Buffer.from("GIF89a....................")), null);
  assert.equal(imageInfo(png(0, 10)), null);
  assert.equal(imageInfo(png(100000, 10)), null);
});

test("file names: pictures, Valve names, lower levels, calibrations", () => {
  assert.deepEqual(overviewFile("de_dust2.png"), { map: "de_dust2", kind: "image", rank: 0 });
  assert.deepEqual(overviewFile("de_dust2_radar_psd.png"), { map: "de_dust2", kind: "image", rank: 10 });
  assert.deepEqual(overviewFile("de_dust2.jpg"), { map: "de_dust2", kind: "image", rank: 2 });
  assert.deepEqual(overviewFile("de_nuke_lower.webp"), { map: "de_nuke", kind: "lower", rank: 1 });
  assert.deepEqual(overviewFile("de_nuke_lower_radar.png"), { map: "de_nuke", kind: "lower", rank: 10 });
  assert.deepEqual(overviewFile("de_nuke.txt"), { map: "de_nuke", kind: "txt", rank: 0 });
  assert.deepEqual(overviewFile("de_nuke.json"), { map: "de_nuke", kind: "json", rank: 0 });
  for (const n of ["De_Dust2.png", "de_dust2.svg", "de_dust2.dds", ".png", "../x.png", "de dust2.png", "README.md", "_x.png"]) assert.equal(overviewFile(n), null, n);
});

test("built-in calibrations: valid JSON per map, CS2 levels as in map-levels.ts, every picture has one", () => {
  const root = path.join(process.cwd(), "overviews");
  const games = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  assert.ok(games.includes("cs2") && games.includes("css"));
  for (const g of games) {
    const dir = path.join(root, g);
    const names = readdirSync(dir);
    for (const f of names.filter((n) => n.endsWith(".json"))) {
      const c = parseCalibration(readFileSync(path.join(dir, f), "utf8"), "json");
      assert.ok(c, `${g}/${f}`);
      if (g === "cs2") assert.equal(c.lowerSplit, LEVEL_SPLITS[f.slice(0, -5)] ?? null, f);
    }
    for (const f of names.filter((n) => n.endsWith(".png"))) {
      const file = overviewFile(f);
      assert.ok(file, `${g}/${f}`);
      assert.ok(names.includes(`${file.map}.json`), `${g}/${f} without calibration`);
      assert.equal(imageInfo(readFileSync(path.join(dir, f)))?.type, "image/png", f);
    }
  }
  const dust2 = parseCalibration(readFileSync(path.join(root, "cs2", "de_dust2.json"), "utf8"), "json");
  assert.deepEqual(dust2, { posX: -2470, posY: 3250.6, scale: 4.4, ref: 1024, lowerSplit: null, lowerShift: null });
});
