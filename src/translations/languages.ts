// The languages of the public pages: one JSON file per language in this
// folder, listed here in the order of the language menu.
//
// en.json is the reference with every text; a language file may leave texts
// out, they are then shown in English. To add a language: copy en.json to
// <code>.json, translate the values (keep the {placeholders} and <b> tags),
// add a line below and a flag in components/lang-flag.tsx.
// See README.md in this folder.
//
// dir: "rtl" turns the page right to left. base: a dialect takes every text
// it leaves out from this language instead of English, and its admin area is
// in this language.
// Korean uses the 24-hour clock (-u-hc-h23): Node and the
// browsers name AM/PM differently, which breaks hydration of client charts.

export const LANGUAGES = [
  { code: "en", name: "English", locale: "en-GB", flag: "gb" },
  { code: "de", name: "Deutsch", locale: "de-DE", flag: "de" },
  { code: "bar", name: "Boarisch", locale: "de-DE", flag: "bavaria", base: "de" },
  { code: "gsw", name: "Schwiizerdütsch", locale: "de-CH", flag: "ch", base: "de" },
  { code: "swg", name: "Schwäbisch", locale: "de-DE", flag: "baden-wuerttemberg", base: "de" },
  { code: "nds", name: "Plattdüütsch", locale: "de-DE", flag: "schleswig-holstein", base: "de" },
  { code: "ru", name: "Русский", locale: "ru-RU", flag: "ru" },
  { code: "es", name: "Español", locale: "es-ES", flag: "es" },
  { code: "fr", name: "Français", locale: "fr-FR", flag: "fr" },
  { code: "pt", name: "Português", locale: "pt-PT", flag: "pt" },
  { code: "nl", name: "Nederlands", locale: "nl-NL", flag: "nl" },
  { code: "da", name: "Dansk", locale: "da-DK", flag: "dk" },
  { code: "pl", name: "Polski", locale: "pl-PL", flag: "pl" },
  { code: "pt-br", name: "Português (Brasil)", locale: "pt-BR", flag: "br" },
  { code: "sr", name: "Српски", locale: "sr-RS", flag: "rs" },
  { code: "zh-tw", name: "繁體中文", locale: "zh-TW", flag: "tw" },
  { code: "zh-cn", name: "简体中文", locale: "zh-CN", flag: "cn" },
  { code: "ja", name: "日本語", locale: "ja-JP", flag: "jp" },
  { code: "ko", name: "한국어", locale: "ko-KR-u-hc-h23", flag: "kr" },
  { code: "ar", name: "العربية", locale: "ar", flag: "arab", dir: "rtl" },
  { code: "tr", name: "Türkçe", locale: "tr-TR", flag: "tr" },
  { code: "it", name: "Italiano", locale: "it-IT", flag: "it" },
  { code: "uk", name: "Українська", locale: "uk-UA", flag: "ua" },
  { code: "cs", name: "Čeština", locale: "cs-CZ", flag: "cz" },
  { code: "sv", name: "Svenska", locale: "sv-SE", flag: "se" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];
export type FlagCode = (typeof LANGUAGES)[number]["flag"];

// A dialect (base set) or a full language.
export type Dialect = Extract<(typeof LANGUAGES)[number], { base: string }>["code"];

const info = (code: Lang) => LANGUAGES.find((l) => l.code === code) as { dir?: "rtl"; base?: Lang } | undefined;

// The language the admin area and the banner texts use for this one.
export const baseLang = (code: Lang): Exclude<Lang, Dialect> => (info(code)?.base ?? code) as Exclude<Lang, Dialect>;

// "rtl" for Arabic, else "ltr": the dir of <html>.
export const langDir = (code: Lang): "rtl" | "ltr" => info(code)?.dir ?? "ltr";

export function isLang(v: string | undefined): v is Lang {
  return LANGUAGES.some((l) => l.code === v);
}

// Cookie with the chosen language. Not just "lang": other software on the same
// host (forum, SourceBans) may set a "lang" cookie of its own on "/", and the
// browser then sends both.
export const LANG_COOKIE = "gamewe_lang";
