# Translations

One JSON file per language with the texts of the public pages. `en.json` is
the reference: it holds every key, and any key missing in another file falls
back to the English text, so a translation can be partial.

`languages.ts` lists the languages: code (file name and cookie value), name in
its own language, locale for numbers and dates, and the flag shown in the
language menu. `dir: "rtl"` turns the pages right to left (Arabic; the CSS
uses logical properties such as `margin-inline-start`, keep it that way).
A dialect has `base: "de"`: its file may leave texts out, they come from
German, and its admin area is the German one; `note` is shown after its name
in the menu (machine translated). The menu is `src/components/lang-menu.tsx`, the flag comes from the sprite of
`public/flags` via `lang-flag.tsx`. `index.ts` imports the files.

To add a language:

1. Copy `en.json` to `<code>.json` and translate the values. Keep the keys,
   the `{placeholders}` and the `<b>` tags as they are.
2. Add the language to `LANGUAGES` in `languages.ts` and import the file in
   `index.ts`.
3. The flag is a code of the flag sprite (`public/flags`, flag-icons; `arab`, `bavaria`, `baden-wuerttemberg` and `schleswig-holstein` are own drawings). After adding an SVG there run `npm run flags`.
4. Translate the admin area: add `admin/<code>.ts` and import it in
   `admin/index.ts` (the build fails until it is there).

Ribbon class names (Bronze, Silver, Gold ...) are in
`src/components/badges.tsx`.

## Admin area

The admin texts are written in German and English in the code
(`src/lib/admin-i18n.ts`, `src/lib/admin-texts.ts`, the entity and setting
definitions in `src/lib/admin-entities.ts` and `src/lib/admin-settings.ts`).
Every other language has a file `admin/<code>.ts` that maps each English
text to its translation; a missing text is shown in English. Keep the
`{placeholders}`. `tests/admin-languages.test.ts` fails when a language has
no file or a file lacks a text or holds one that is no longer used, so a
changed English text needs its new translation in every file.
