// Map thumbnails from a game's own files (scripts/overviews/thumbs.ts): VPK
// directory, VTF pictures, DXT blocks. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { contentHeight, decodeDxt, decodeVtf, readVpkDir } from "../scripts/overviews/thumbs.ts";

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
