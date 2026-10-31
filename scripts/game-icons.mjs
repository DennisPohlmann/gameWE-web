// Draws public/games/<code>/icon.png (32 x 32) from icon.svg, for every
// game folder that has an icon.svg. The pages show icon.png before the
// server names (src/components/game-icon.tsx); each folder's LICENSE.txt
// says where the picture comes from and under which license.
//
//   npm run game-icons      (after changing an icon.svg)
//
// The PNGs are committed; the script needs the devDependency `sharp`.
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "public", "games");
const SIZE = 32;

for (const code of (await readdir(dir)).sort()) {
  const svg = path.join(dir, code, "icon.svg");
  if (!existsSync(svg)) continue;
  await sharp(svg, { density: 300 }).resize(SIZE, SIZE).png({ compressionLevel: 9, palette: true }).toFile(path.join(dir, code, "icon.png"));
  console.log(`${code}/icon.png`);
}
