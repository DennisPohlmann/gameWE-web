# Translations

One JSON file per language with the texts of the public pages. `en.json` is
the reference: it holds every key, and any key missing in another file falls
back to the English text, so a translation can be partial.

`languages.ts` lists the languages: code (file name and cookie value), name in
its own language, locale for numbers and dates, and the flag shown in the
footer (drawn in `src/components/lang-flag.tsx`). `index.ts` imports the files.

To add a language:

1. Copy `en.json` to `<code>.json` and translate the values. Keep the keys,
   the `{placeholders}` and the `<b>` tags as they are.
2. Add the language to `LANGUAGES` in `languages.ts` and import the file in
   `index.ts`.
3. If it needs a new flag, add it to `lang-flag.tsx`.

Ribbon class names (Bronze, Silver, Gold ...) are in
`src/components/badges.tsx`. The admin area is only in German and English
(`src/lib/admin-i18n.ts`).
