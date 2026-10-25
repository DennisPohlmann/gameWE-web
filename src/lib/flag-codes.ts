import { FLAG_SPRITE } from "./flag-sprite";

// Country codes with a flag in public/flags (flag-icons 7.2.3, MIT, 4:3 SVG),
// all drawn into public/flags/sprite.png (scripts/flags-sprite.mjs).
export const FLAG_CODES: ReadonlySet<string> = new Set(FLAG_SPRITE.codes);

// The sprite with its version, for the cache (a year).
export const FLAG_SPRITE_URL = `/flags/sprite.png?v=${FLAG_SPRITE.v}`;

// Where a flag sits in the sprite, as CSS background-position in percent
// (so it fits any size of the box); the placeholder for unknown codes.
export function flagPos(code: string): string {
  let i = FLAG_SPRITE.codes.indexOf(code);
  if (i < 0) i = FLAG_SPRITE.codes.indexOf("unknown");
  const pct = (n: number, of: number) => (of > 1 ? `${((n / (of - 1)) * 100).toFixed(4).replace(/\.?0+$/, "")}%` : "0%");
  return `${pct(i % FLAG_SPRITE.cols, FLAG_SPRITE.cols)} ${pct(Math.floor(i / FLAG_SPRITE.cols), FLAG_SPRITE.rows)}`;
}
