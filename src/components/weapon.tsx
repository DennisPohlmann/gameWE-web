import { basePath } from "@/lib/base-path";

// The weapon images of one base game (public/weapons/<dir>/<code>.webp) with
// their width and height. Server code gets it from weaponImages() in
// src/lib/weapons.ts; client components get it as a prop, so the full list
// stays out of the browser bundle.
export type WeaponSet = { dir: string; sizes: Readonly<Record<string, readonly [number, number]>> };

// A weapon as its image (HLstatsX:CE), scaled down to at most `height`
// pixels, with the name as alt text and tooltip. Without an image the name is
// shown as text. Width and height are set, so the row does not jump while
// the image loads.
export function Weapon({
  set,
  code,
  name,
  height = 22,
}: {
  set: WeaponSet | null | undefined;
  code: string | null | undefined;
  name: string | null | undefined;
  height?: number;
}) {
  const key = (code ?? "").trim().toLowerCase();
  const label = (name ?? "").trim() || key || "?";
  const size = set && key && Object.hasOwn(set.sizes, key) ? set.sizes[key] : undefined;
  if (!set || !size) return <>{label}</>;
  const h = Math.min(height, size[1]);
  const w = Math.round((size[0] * h) / size[1]);
  return (
    <img
      className="weapon-img"
      src={`${basePath}/weapons/${set.dir}/${encodeURIComponent(key)}.webp`}
      width={w}
      height={h}
      alt={label}
      title={label}
      loading="lazy"
      decoding="async"
    />
  );
}
