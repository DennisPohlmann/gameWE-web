// The languages of the public pages: one JSON file per language in this
// folder, listed here in the order of the flags in the header.
//
// en.json is the reference with every text; a language file may leave texts
// out, they are then shown in English. To add a language: copy en.json to
// <code>.json, translate the values (keep the {placeholders} and <b> tags),
// add a line below and a flag in components/lang-flag.tsx.
// See README.md in this folder.

export const LANGUAGES = [
  { code: "en", name: "English", locale: "en-GB", flag: "gb" },
  { code: "de", name: "Deutsch", locale: "de-DE", flag: "de" },
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
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];
export type FlagCode = (typeof LANGUAGES)[number]["flag"];

export function isLang(v: string | undefined): v is Lang {
  return LANGUAGES.some((l) => l.code === v);
}

// Cookie with the chosen language. Not just "lang": other software on the same
// host (forum, SourceBans) may set a "lang" cookie of its own on "/", and the
// browser then sends both.
export const LANG_COOKIE = "gamewe_lang";
