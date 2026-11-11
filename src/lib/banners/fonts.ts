import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// The self-hosted OFL fonts of the site for the banner pictures, read once
// from public/vendor/fonts (scripts/vendor.mjs copies them there). Latin,
// Latin Extended, Cyrillic and Greek; Satori takes the next font of the list
// for a glyph the first one lacks. No CJK font: Chinese names show boxes.
const SUBSETS = ["latin", "latin-ext", "cyrillic", "greek"];

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

let fonts: Promise<Font[]> | null = null;

export function bannerFonts(): Promise<Font[]> {
  fonts ??= Promise.all(
    ["inter", "noto-sans"].flatMap((family) =>
      SUBSETS.flatMap((subset) =>
        ([400, 700] as const).map(async (weight): Promise<Font> => {
          const buf = await readFile(path.join(process.cwd(), "public", "vendor", "fonts", `${family}-${subset}-${weight}-normal.woff`));
          return { name: family === "inter" ? "Inter" : "Noto Sans", data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight, style: "normal" };
        }),
      ),
    ),
  ).catch((e) => {
    fonts = null;
    throw e;
  });
  return fonts;
}
