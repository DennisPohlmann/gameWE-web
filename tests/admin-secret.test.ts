// ADMIN_SECRET: placeholders and weak values lock the admin area like a
// missing secret. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { adminSecretProblem } from "../src/lib/admin-secret.ts";

test("a random secret is accepted", () => {
  assert.equal(adminSecretProblem("3f9c1a7be04d52e8a6c1f0b9d7e2435a8c6b1e0f9d2a7c4b5e8f1a0d3c6b9e2f"), null);
});

test("too short", () => {
  assert.equal(adminSecretProblem(""), "short");
  assert.equal(adminSecretProblem("3f9c1a7be04d52e8a6c1f0b9d7e2435"), "short");
});

test("placeholders of the docs are refused", () => {
  assert.equal(adminSecretProblem("change-me-change-me-change-me-change-me"), "placeholder");
  assert.equal(adminSecretProblem("CHANGE_ME_to_a_random_value_of_32_chars"), "placeholder");
  assert.equal(adminSecretProblem("please changeme 0123456789abcdefghijkl"), "placeholder");
});

test("repeated patterns are refused", () => {
  assert.equal(adminSecretProblem("a".repeat(64)), "weak");
  assert.equal(adminSecretProblem("12".repeat(20)), "weak");
});
