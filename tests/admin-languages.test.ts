// Every language of the public pages is also an admin language, with a
// translation of every admin text. A new language in languages.ts, a new or
// changed English admin text without its translations fails here.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as entities from "../src/lib/admin-entities.ts";
import { adminDict, localized, tr } from "../src/lib/admin-i18n.ts";
import * as settings from "../src/lib/admin-settings.ts";
import * as texts from "../src/lib/admin-texts.ts";
import { ADMIN_TEXTS } from "../src/translations/admin/index.ts";
import { LANGUAGES } from "../src/translations/languages.ts";

// Every English text: all strings of a { de, en } pair or table, found
// anywhere in the definitions. Pairs with `all` bring every language along.
function englishTexts(): Set<string> {
  const out = new Set<string>();
  const strings = (v: unknown): void => {
    if (typeof v === "string") out.add(v);
    else if (v && typeof v === "object") Object.values(v).forEach(strings);
  };
  const walk = (v: unknown, seen: Set<unknown>): void => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    const o = v as Record<string, unknown>;
    if ("de" in o && "en" in o && typeof o.de === typeof o.en) {
      if (!("all" in o)) strings(o.en);
      return;
    }
    Object.values(o).forEach((x) => walk(x, seen));
  };
  const seen = new Set<unknown>();
  strings(adminDict("en"));
  for (const mod of [entities, settings, texts]) walk({ ...mod }, seen);
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();

test("every public language is an admin language with all texts", () => {
  const en = englishTexts();
  assert.ok(en.size > 500, `only ${en.size} texts found`);
  for (const { code } of LANGUAGES) {
    if (code === "de" || code === "en") continue;
    const t = ADMIN_TEXTS[code];
    assert.ok(t, `no admin texts for ${code}`);
    const keys = new Set(Object.keys(t));
    assert.deepEqual([...en].filter((k) => !keys.has(k)), [], `${code}: texts missing`);
    assert.deepEqual([...keys].filter((k) => !en.has(k)), [], `${code}: texts no longer used`);
    for (const [k, v] of Object.entries(t)) {
      assert.ok(v.trim(), `${code}: empty text for "${k}"`);
      assert.deepEqual(placeholders(v), placeholders(k), `${code}: placeholders of "${k}"`);
    }
  }
});

test("lookups use the translation and fall back to English", () => {
  const l = { de: "Speichern", en: "Save" };
  assert.equal(tr(l, "de"), "Speichern");
  assert.equal(tr(l, "en"), "Save");
  assert.equal(tr(l, "pl"), ADMIN_TEXTS.pl.Save);
  assert.equal(tr({ de: "x", en: "not a known text" }, "pl"), "not a known text");
  assert.equal(tr({ de: "x", en: "y", all: { pl: "z" } }, "pl"), "z");
  const table = { de: { a: "A", list: ["B"] }, en: { a: "Save", list: ["Save"] } };
  assert.deepEqual(localized(table, "pl"), { a: ADMIN_TEXTS.pl.Save, list: [ADMIN_TEXTS.pl.Save] });
  assert.equal(localized(table, "pl"), localized(table, "pl"));
  assert.equal(adminDict("zh-cn").login, ADMIN_TEXTS["zh-cn"][adminDict("en").login]);
});
