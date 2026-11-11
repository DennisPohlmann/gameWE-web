// The CS2 log URL is /<log token>: the admin texts name only that form, the
// form refuses a token another server has, and the generate button exists.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = (path: string) => readFileSync(path, "utf8");

test("the CS2 hints show the URL /<log token>, not the game port form", () => {
  const i18n = src("src/lib/admin-i18n.ts");
  assert.equal(i18n.match(/41338\/<(Log-Token|log token)>\\"/g)?.length, 2);
  assert.doesNotMatch(i18n, /41338\/\{port\}/);
  assert.equal(i18n.match(/cs2LogTokenNew:/g)?.length, 2);
  assert.doesNotMatch(src("src/lib/admin-entities.ts"), /41338\/<(Spielport|game port)>/);
  assert.match(src("src/app/admin/(panel)/[entity]/[id]/page.tsx"), /<TokenGenerate target=.* copy=\{a\.tokCopy\} copied=\{a\.tokCopied\}/);
  assert.match(src("src/components/admin/token-generate.tsx"), /navigator\.clipboard\.writeText\(token\)/);
  // A Source server gets a generated sv_logsecret: 1 to 2147483647.
  assert.match(src("src/app/admin/(panel)/[entity]/[id]/page.tsx"), /label=\{a\.logSecretNew\}.* numeric \/>/);
  assert.match(src("src/components/admin/token-generate.tsx"), /% 2147483647\) \+ 1/);
});

test("a log token another server has is refused", () => {
  assert.match(src("src/lib/admin-data.ts"), /SELECT 1 AS x FROM hlstats_Servers WHERE log_secret = \? AND serverId <> \?/);
});
