// Every secret in the admin interface (password inputs, shown tokens, the
// TOTP key) is masked by default and has the eye button (RevealInput).
// Run with `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));
const admin = [...files("src/app/admin"), ...files("src/components/admin")];
const src = (f: string) => readFileSync(f, "utf8");

test("no plain password input in the admin interface", () => {
  for (const f of admin) {
    if (f.endsWith("reveal-input.tsx")) continue;
    assert.doesNotMatch(src(f), /type="password"/, f);
  }
});

test("read-only secrets go through RevealInput", () => {
  for (const f of admin) assert.doesNotMatch(src(f), /<input [^>]*readOnly value=/, f);
  assert.match(src("src/components/admin/api-token-form.tsx"), /<RevealInput \{\.\.\.noAutofill\} show=\{text\.valueShow\}[^>]*readOnly value=\{shown/);
  assert.match(src("src/app/admin/(panel)/account/page.tsx"), /<RevealInput \{\.\.\.noAutofill\} show=\{a\.valueShow\}[^>]*readOnly value=\{pending/);
});

test("the eye button is accessible and starts masked", () => {
  const r = src("src/components/admin/reveal-input.tsx");
  assert.match(r, /useState\(false\)/);
  assert.match(r, /type=\{shown \? "text" : "password"\}/);
  assert.match(r, /aria-pressed=\{shown\}/);
  assert.match(r, /aria-label=\{shown \? hide : show\}/);
  const b = src("src/components/admin/backup-codes-form.tsx");
  assert.match(b, /visible \? c : c\.replace/);
  assert.match(b, /aria-pressed=\{visible\}/);
});

test("a generated log token is shown via the eye button, not by changing the type", () => {
  const t = src("src/components/admin/token-generate.tsx");
  assert.doesNotMatch(t, /\.type = "text"/);
  assert.match(t, /aria-controls="\$\{target\}"\]\[aria-pressed="false"\]/);
});
