import "server-only";
import { cookies } from "next/headers";

// Light or dark look of the admin area (its own design, independent of the
// templates of the public pages). "auto" follows the device.
export const ADMIN_THEMES = ["auto", "light", "dark"] as const;
export type AdminTheme = (typeof ADMIN_THEMES)[number];
export const ADMIN_THEME_COOKIE = "gamewe_admin_theme";

export function isAdminTheme(v: unknown): v is AdminTheme {
  return typeof v === "string" && (ADMIN_THEMES as readonly string[]).includes(v);
}

export async function getAdminTheme(): Promise<AdminTheme> {
  const v = (await cookies()).get(ADMIN_THEME_COOKIE)?.value;
  return isAdminTheme(v) ? v : "auto";
}
