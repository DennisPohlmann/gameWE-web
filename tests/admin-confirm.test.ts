// One way to confirm in the admin area: a dialog (ConfirmButton) instead of
// "I am sure" checkboxes, and changes nobody saved yet are pointed out.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));
const src = (f: string) => readFileSync(f, "utf8");

test("no confirmation checkbox left in the admin area", () => {
  for (const f of [...files("src/app/admin"), ...files("src/components/admin"), "src/components/reset-form.tsx"]) {
    assert.doesNotMatch(src(f), /type="checkbox" name="(confirm|understood)"/, f);
  }
});

test("deleting asks in a dialog for the name, also right in the list", () => {
  const edit = src("src/app/admin/(panel)/[entity]/[id]/page.tsx");
  // Erasing a player and deleting a row: both want the name typed.
  assert.equal(edit.match(/typed=\{title\.trim\(\) \|\| id\}/g)?.length, 2);
  const list = src("src/app/admin/(panel)/[entity]/page.tsx");
  assert.match(list, /<form action=\{deleteAction\}>[\s\S]*?<ConfirmButton[\s\S]*?typed=\{rowName\(r\)\.trim\(\) \|\| String\(r\.__pk\)\}/);
  assert.match(src("src/app/admin/(panel)/admin-roles/[id]/page.tsx"), /typed=\{role\.name\}/);
  // Nobody deletes their own account from the list.
  assert.match(list, /disabled=\{e\.key === "users" && String\(r\.__pk\) === user\.username\}/);
  const c = src("src/components/admin/confirm-button.tsx");
  // Only the dialog's button submits, with the value the server action checks.
  assert.match(c, /<button type="button" className=\{className\} onClick=\{open\}/);
  assert.match(c, /<button type="submit" className="button danger solid" name=\{name\} value=\{value\} disabled=\{!ok\}>/);
});

test("the ranking reset needs the ranking's code typed", () => {
  const r = src("src/components/reset-form.tsx");
  assert.match(r, /const understood = game !== "" && typed\.trim\(\)\.toLowerCase\(\) === game\.toLowerCase\(\);/);
  assert.match(r, /name="confirmed" value=\{understood \? "yes" : ""\}/);
  // The server checks the typed code too (a form sent without the dialog).
  assert.match(r, /name="typed" value=\{typed\}/);
  assert.match(src("src/app/admin/actions.ts"), /form\.get\("confirmed"\) !== "yes" \|\| String\(form\.get\("typed"\) \?\? ""\)\.trim\(\)\.toLowerCase\(\) !== game\.toLowerCase\(\)/);
});

test("unsaved changes show a bar with the form's own save button", () => {
  const layout = src("src/app/admin/(panel)/layout.tsx");
  assert.match(layout, /<UnsavedBar text=/);
  const b = src("src/components/admin/unsaved-bar.tsx");
  assert.match(b, /onClick=\{\(\) => save\.click\(\)\}/);
  assert.match(b, /addEventListener\("beforeunload", leave\)/);
});
