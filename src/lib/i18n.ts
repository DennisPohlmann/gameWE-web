import "server-only";
import { cookies, headers } from "next/headers";
import { config } from "./config";
import { dicts, type Dict } from "@/translations";
import { LANGUAGES, LANG_COOKIE, isLang, type Lang } from "@/translations/languages";

// Texts of the public pages, one file per language in src/translations/.

export type { Dict, Lang };
export const LANGS: Lang[] = LANGUAGES.map((l) => l.code);

// The language from the cookie (flags in the header), else the browser's
// Accept-Language, else DEFAULT_LANG.
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(c)) return c;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",").slice(0, 8)) {
    const tag = part.split(";")[0]?.trim().toLowerCase() ?? "";
    const hit = fromTag(tag);
    if (hit) return hit;
  }
  return config.defaultLang;
}

function fromTag(tag: string): Lang | null {
  if (isLang(tag)) return tag;
  const primary = tag.split("-")[0];
  if (primary === "zh") return /-(tw|hk|mo|hant)\b/.test(tag) ? "zh-tw" : "zh-cn";
  if (primary === "pt") return tag === "pt-br" ? "pt-br" : "pt";
  if (primary === "nb" || primary === "no") return null;
  return isLang(primary) ? primary : null;
}

export async function getDict(): Promise<{ lang: Lang; t: Dict }> {
  const lang = await getLang();
  return { lang, t: dicts[lang] };
}

// The admin area is in German and English only.
export async function getAdminLang(): Promise<"de" | "en"> {
  return (await getLang()) === "de" ? "de" : "en";
}

// fill("Tracking {n}", { n: 3 }) -> "Tracking 3"
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}
