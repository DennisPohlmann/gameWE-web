// My account: one page per part (src/app/admin/(panel)/account/[[...part]]),
// listed in the side menu, and every redirect of an account action leads to
// one of them. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync("src/app/admin/(panel)/account/[[...part]]/page.tsx", "utf8");
const nav = readFileSync("src/components/admin/nav.tsx", "utf8");
const actions = readFileSync("src/app/admin/actions.ts", "utf8");
const parts = JSON.parse(page.match(/const PARTS = (\[[^\]]*\]);/)![1]) as string[];

test("the side menu lists every part of the account page", () => {
  const menu = [...nav.slice(nav.indexOf("const ACCOUNT_PARTS"), nav.indexOf("const AREAS")).matchAll(/\["([a-z-]+)", "/g)].map((m) => m[1]);
  assert.deepEqual(menu, parts);
});

test("account actions redirect to an existing part, without a fragment", () => {
  const targets = [...actions.matchAll(/redirect\(["`]\/admin\/account([^"`?]*)/g)].map((m) => m[1]);
  assert.ok(targets.length > 10);
  for (const t of targets) assert.ok(parts.includes(t.slice(1)), `/admin/account${t}`);
  assert.doesNotMatch(actions, /\/admin\/account[^"`]*#/);
});

test("old links with a fragment are sent on to their part", () => {
  assert.match(page, /OLD_HASHES\.map\(\(\[hash, p\]\) => \(\s*<HashRedirect key=\{hash\} hash=\{hash\} to=\{`\/admin\/account\/\$\{p\}`\} \/>/);
  assert.match(page, /\["name", "profile"\], \["password", "profile"\]/);
  assert.match(readFileSync("src/app/admin/(panel)/totp/page.tsx", "utf8"), /redirect\("\/admin\/account\/totp"\)/);
});
