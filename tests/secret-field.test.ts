// What a secret field of an admin form writes: empty keeps it, the Remove
// switch (or a single "-") clears it. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { secretFormValue } from "../src/lib/secret-field.ts";

test("an empty field keeps the stored secret", () => {
  assert.equal(secretFormValue(null, null), undefined);
  assert.equal(secretFormValue("", null), undefined);
  assert.equal(secretFormValue("   ", null), undefined);
});

test("a value replaces it", () => {
  assert.equal(secretFormValue(" s3cret ", null), "s3cret");
});

test("the Remove switch clears it, also with a value typed in", () => {
  assert.equal(secretFormValue("", "1"), "");
  assert.equal(secretFormValue("new", "1"), "");
  assert.equal(secretFormValue("new", "0"), "new");
});

test("a single minus still clears it", () => {
  assert.equal(secretFormValue("-", null), "");
});
