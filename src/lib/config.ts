import { env } from "./env";
import { isLang, type Lang } from "@/translations/languages";
// Settings from the environment. See .env.example.

function int(name: string, fallback: number): number {
  const v = Number.parseInt(env(name) ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const config = {
  siteName: env("SITE_NAME") || "gameWE",
  defaultLang: ((v) => (isLang(v) ? v : "de"))(env("DEFAULT_LANG")?.toLowerCase()) as Lang,
  activityDays: int("ACTIVITY_DAYS", 28),
  pageSize: int("PAGE_SIZE", 50),
} as const;
