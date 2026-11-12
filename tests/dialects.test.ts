// A dialect (base in languages.ts) takes the texts it leaves out from its
// base language, not from English. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { dicts } from "../src/translations/index.ts";

test("a dialect falls back to German, its own texts win", () => {
  // The privacy page is left out of the dialects on purpose.
  for (const d of ["bar", "gsw", "nds"] as const) assert.equal(dicts[d].privacy.title, dicts.de.privacy.title, d);
  assert.notEqual(dicts.bar.players, dicts.de.players);
  assert.notEqual(dicts.de.privacy.title, dicts.en.privacy.title);
});
