// The six built-in templates and the fallback from removed ones
// (src/lib/skin-fallback.ts). Run with `npm test`.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { REMOVED_TEMPLATES, replacedTemplate } from "../src/lib/skin-fallback.ts";

// npm test runs in the repository root.
const builtIn = readdirSync(path.join(process.cwd(), "templates"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

test("exactly the six kept templates are built in", () => {
  assert.deepEqual(builtIn, ["dark", "light", "modern-dark", "modern-light", "modern-orange", "orange"]);
});

test("every removed template points to a built-in one and is gone itself", () => {
  for (const [from, to] of Object.entries(REMOVED_TEMPLATES)) {
    assert.ok(builtIn.includes(to), `${from} -> ${to}`);
    assert.ok(!builtIn.includes(from), from);
  }
});

test("removed templates fall back by family", () => {
  for (const id of ["blue", "green", "pink", "red", "game-csgo", "game-css", "game-cstrike", "game-dods", "game-hl2mp"]) assert.equal(replacedTemplate(id, builtIn), "dark", id);
  assert.equal(replacedTemplate("game-tf", builtIn), "light");
  for (const id of ["modern-blue", "modern-gold", "modern-green", "modern-pink", "modern-red"]) assert.equal(replacedTemplate(id, builtIn), "modern-dark", id);
});

test("kept, own and unknown templates stay as they are", () => {
  for (const id of builtIn) assert.equal(replacedTemplate(id, builtIn), id);
  // An own template in TEMPLATES_DIR with a removed name wins.
  assert.equal(replacedTemplate("blue", [...builtIn, "blue"]), "blue");
  assert.equal(replacedTemplate("clan-blue", builtIn), "clan-blue");
  for (const id of ["", "constructor", "__proto__", "toString"]) assert.equal(replacedTemplate(id, builtIn), id, id);
});

test("no replacement when its target is missing too", () => {
  assert.equal(replacedTemplate("blue", ["orange"]), "blue");
});
