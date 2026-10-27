// The folders of your own templates and map overviews are fixed paths; the
// retired TEMPLATES_DIR and OVERVIEWS_DIR only cause a warning. Run with
// `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { OWN_OVERVIEWS, OWN_TEMPLATES, retiredDirWarning } from "../src/lib/content-dirs.ts";

test("the own folders are the documented fixed paths", () => {
  assert.equal(OWN_TEMPLATES, "/var/lib/gamewe/web/templates");
  assert.equal(OWN_OVERVIEWS, "/var/lib/gamewe/web/overviews");
});

test("no warning without the old variable", () => {
  assert.equal(retiredDirWarning("TEMPLATES_DIR", undefined, OWN_TEMPLATES), null);
  assert.equal(retiredDirWarning("TEMPLATES_DIR", "", OWN_TEMPLATES), null);
});

test("the old variable on the fixed path: only remove it", () => {
  for (const v of [OWN_TEMPLATES, `${OWN_TEMPLATES}/`]) {
    const w = retiredDirWarning("TEMPLATES_DIR", v, OWN_TEMPLATES) ?? "";
    assert.match(w, /no longer read/);
    assert.match(w, /remove TEMPLATES_DIR/);
  }
});

test("the old variable elsewhere: names the folder to move or mount", () => {
  const w = retiredDirWarning("OVERVIEWS_DIR", "/app/custom-overviews", OWN_OVERVIEWS) ?? "";
  assert.match(w, /^OVERVIEWS_DIR=\/app\/custom-overviews is ignored/);
  assert.match(w, /\/var\/lib\/gamewe\/web\/overviews/);
  // No control characters from the environment in the log line.
  assert.doesNotMatch(retiredDirWarning("OVERVIEWS_DIR", "/x\n/y\u001b[1m", OWN_OVERVIEWS) ?? "", /[\u0000-\u001f]/);
});
