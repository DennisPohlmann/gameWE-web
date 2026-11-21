// Map thumbnails from a game's own files (scripts/overviews/thumbs.ts): VPK
// directory, VTF pictures, DXT blocks. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { contentHeight, decodeDxt, decodeVtf, findThumbs, pngInside, readVpkDir } from "../scripts/overviews/thumbs.ts";

test("VPK directory: entries in the directory file and in numbered archives, names in lower case", () => {
  const z = (s: string) => Buffer.from(`${s}\0`, "latin1");
  const entry = (archive: number, offset: number, length: number) => {
    const b = Buffer.alloc(18);
    b.writeUInt16LE(archive, 6);
    b.writeUInt32LE(offset, 8);
    b.writeUInt32LE(length, 12);
    b.writeUInt16LE(0xffff, 16);
    return b;
  };
  const tree = Buffer.concat([z("vtf"), z("materials/vgui/maps"), z("menu_thumb_De_Dust2"), entry(0x7fff, 0, 3), z("menu_thumb_cs_italy"), entry(5, 100, 9), z(""), z(""), z("")]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x55aa1234, 0);
  head.writeUInt32LE(1, 4);
  head.writeUInt32LE(tree.length, 8);
  const { entries, dataStart } = readVpkDir(Buffer.concat([head, tree, Buffer.from("abc")]));
  assert.equal(dataStart, 12 + tree.length);
  assert.deepEqual([...entries.keys()], ["materials/vgui/maps/menu_thumb_de_dust2.vtf", "materials/vgui/maps/menu_thumb_cs_italy.vtf"]);
  assert.deepEqual({ ...entries.get("materials/vgui/maps/menu_thumb_cs_italy.vtf"), preload: undefined }, { archive: 5, offset: 100, length: 9, preload: undefined });
  assert.throws(() => readVpkDir(Buffer.alloc(16)), /not a VPK/);
});

test("DXT1: the two colours and their mixes per 2-bit index", () => {
  // red (0xf800) and blue (0x001f), indices 0,1,2,3 in the first row
  const block = Buffer.alloc(8);
  block.writeUInt16LE(0xf800, 0);
  block.writeUInt16LE(0x001f, 2);
  block.writeUInt32LE(0b11100100, 4);
  const px = decodeDxt(block, 4, 4, 1);
  assert.deepEqual([...px.subarray(0, 16)], [255, 0, 0, 255, 0, 0, 255, 255, 170, 0, 85, 255, 85, 0, 170, 255]);
});

test("VTF: the largest picture is the last one; BGR888 to RGBA; empty rows at the bottom are cut", () => {
  const head = Buffer.alloc(80);
  head.write("VTF\0", 0, "latin1");
  head.writeUInt16LE(2, 16);
  head.writeUInt16LE(2, 18);
  head.writeInt32LE(3, 52);
  // 2x2 BGR: blue, green / white, white
  const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 255, 255, 255, 255, 255, 255]);
  const { width, height, rgba } = decodeVtf(Buffer.concat([head, pixels]));
  assert.deepEqual([width, height, ...rgba.subarray(0, 8)], [2, 2, 0, 0, 255, 255, 0, 255, 0, 255]);
  assert.equal(contentHeight(rgba, 2, 2), 1);
  head.writeInt32LE(99, 52);
  assert.throws(() => decodeVtf(Buffer.concat([head, pixels])), /picture format 99/);
});

// Left 4 Dead keeps its map pictures as materials/vgui/maps/<map>.vtf next
// to campaign and background pictures: only those named like a map of the
// folders count; menu_thumb_<map> always; a later folder wins.
test("findThumbs takes plain pictures only for maps, over several folders", () => {
  const root = mkdtempSync(path.join(tmpdir(), "thumbs-"));
  try {
    const put = (rel: string, body = "x") => {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), body);
    };
    put("base/maps/c1m1_hotel.bsp");
    put("base/materials/vgui/maps/c1m1_hotel.vtf", "old");
    put("base/materials/vgui/maps/background01_exit.vtf");
    put("base/materials/vgui/maps/menu_thumb_de_dust2.vtf");
    put("dlc/maps/c9m1_alleys.bsp");
    put("update/materials/vgui/maps/c9m1_alleys.vtf");
    put("update/materials/vgui/maps/c1m1_hotel.vtf", "new");
    const got = findThumbs(["base", "dlc", "update"].map((d) => path.join(root, d)));
    assert.deepEqual([...got.keys()].sort(), ["c1m1_hotel", "c9m1_alleys", "de_dust2"]);
    assert.equal(got.get("c1m1_hotel")?.toString(), "new");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// CS:GO: the panorama screenshot of a map (a PNG) wins over its old
// menu_thumb; screenshots of maps the game does not ship are left out.
test("findThumbs takes the CS:GO screenshots of the game's maps", () => {
  const root = mkdtempSync(path.join(tmpdir(), "thumbs-"));
  try {
    const put = (rel: string, body: string | Buffer = "x") => {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), body);
    };
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1]);
    const shots = "materials/panorama/images/map_icons/screenshots/360p";
    put("maps/de_dust2.bsp");
    put("materials/vgui/maps/menu_thumb_de_dust2.vtf");
    put(`${shots}/de_dust2.png`, png);
    put(`${shots}/random.png`, png);
    const got = findThumbs([root]);
    assert.deepEqual([...got.keys()], ["de_dust2"]);
    assert.deepEqual(got.get("de_dust2"), png);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// CS2: the screenshots are Source 2 textures (<map>_png.vtex_c) that carry
// the PNG; a map is maps/<map>.vpk.
test("findThumbs takes the PNG inside CS2's screenshot textures", () => {
  const root = mkdtempSync(path.join(tmpdir(), "thumbs-"));
  try {
    const put = (rel: string, body: string | Buffer = "x") => {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), body);
    };
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from("data"), Buffer.from("IEND"), Buffer.alloc(4)]);
    const vtex = Buffer.concat([Buffer.from("RED2 header"), png, Buffer.from("trailing")]);
    put("maps/de_dust2.vpk");
    put("panorama/images/map_icons/screenshots/360p/de_dust2_png.vtex_c", vtex);
    put("panorama/images/map_icons/screenshots/360p/random_png.vtex_c", vtex);
    assert.deepEqual(pngInside(vtex), png);
    const got = findThumbs([root]);
    assert.deepEqual([...got.keys()], ["de_dust2"]);
    assert.deepEqual(got.get("de_dust2"), png);
    assert.equal(pngInside(Buffer.from("no picture")).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// L4D2's ports of The Sacrifice (c7) and No Mercy (c8) ship no picture of
// their own: they get the one of the same Left 4 Dead map.
test("findThumbs gives L4D2's c7 and c8 maps the picture of the same L4D map", () => {
  const root = mkdtempSync(path.join(tmpdir(), "thumbs-"));
  try {
    const put = (rel: string, body = "x") => {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), body);
    };
    put("maps/c7m1_docks.bsp");
    put("maps/c8m5_rooftop.bsp");
    put("materials/vgui/maps/l4d_river01_docks.vtf", "docks");
    put("materials/vgui/maps/l4d_hospital05_rooftop.vtf", "rooftop");
    const got = findThumbs([root]);
    assert.deepEqual([...got.keys()].sort(), ["c7m1_docks", "c8m5_rooftop"]);
    assert.equal(got.get("c7m1_docks")?.toString(), "docks");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
