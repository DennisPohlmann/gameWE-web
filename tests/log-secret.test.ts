// The log secret field of the server admin: the same rule as the
// collector's logparse.CheckSecret. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { isLogSecret, isLogToken } from "../src/lib/log-secret.ts";

test("numbers 1..2147483647 are log secrets", () => {
  for (const s of ["1", "42", "2147483647"]) assert.ok(isLogSecret(s), s);
});

test("anything else is not", () => {
  for (const s of ["", "0", "007", "2147483648", "-5", "+5", "12a", "1 2", "1;quit", '"1"', "１２", "9".repeat(65)]) {
    assert.ok(!isLogSecret(s), s);
  }
});

test("a log token is 16 to 64 letters, digits, - or _, like logparse.CheckToken", () => {
  for (const s of ["abcdefghijklmnop", "A-b_c-0123456789", "a".repeat(64)]) assert.ok(isLogToken(s), s);
  for (const s of ["", "1234567", "a".repeat(65), "abcdefghijklmnop/x", 'abcdefghijklmnop"', "abcdefghijklmnop;quit", "abcdefghijklmnop q", "abcdefghijklmnop\n"]) {
    assert.ok(!isLogToken(s), s);
  }
});
