import type { WeaponSet } from "@/components/weapon";
import { WEAPON_IMAGES } from "@/lib/weapon-images";

// Weapon images of a ranking's base game (Game.realgame), null when gameWE
// ships none for it.
export function weaponImages(realgame: string | null | undefined): WeaponSet | null {
  const dir = (realgame ?? "").trim().toLowerCase();
  const sizes = Object.hasOwn(WEAPON_IMAGES, dir) ? WEAPON_IMAGES[dir] : undefined;
  return sizes ? { dir, sizes } : null;
}
