// Rows per page: the admin setting and the dropdown under the tables offer
// the same steps (at most 250); old free values snap to a step, so the
// dropdown always has the configured size selected. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, pageSizeStep } from "../src/lib/page-size.ts";
import { envBacked, envFormValues } from "../src/lib/config.ts";
import { allSettings } from "../src/lib/admin-settings.ts";

const noEnv = () => undefined;

test("the steps go up to 250 and contain the default", () => {
  assert.deepEqual([...PAGE_SIZES], [10, 25, 50, 100, 250]);
  assert.ok((PAGE_SIZES as readonly number[]).includes(DEFAULT_PAGE_SIZE));
});

test("every step stays itself", () => {
  for (const n of PAGE_SIZES) assert.equal(pageSizeStep(String(n)), n);
});

test("old free values snap to the largest step not above them", () => {
  assert.equal(pageSizeStep("30"), 25);
  assert.equal(pageSizeStep("99"), 50);
  assert.equal(pageSizeStep("500"), 250);
  assert.equal(pageSizeStep("1"), 10);
  assert.equal(pageSizeStep(" 100 "), 100);
});

test("invalid values are not a page size", () => {
  for (const v of ["", "0", "-5", "abc", "1e3", "12.5", undefined]) assert.equal(pageSizeStep(v), null);
});

test("the site always uses a step the dropdown offers", () => {
  for (const v of ["30", "500", "7", "250", "100"]) {
    const n = envBacked({ gamewe_page_size: v }, noEnv).pageSize;
    assert.ok((PAGE_SIZES as readonly number[]).includes(n), `${v} -> ${n}`);
  }
  assert.equal(envBacked({}, (k) => (k === "PAGE_SIZE" ? "40" : undefined)).pageSize, 25);
  assert.equal(envFormValues((k) => (k === "PAGE_SIZE" ? "1000" : undefined)).gamewe_page_size, "250");
});

test("the admin dropdown offers exactly these steps and its default is one", () => {
  const s = allSettings.find((x) => x.key === "gamewe_page_size");
  assert.equal(s?.type, "choice");
  assert.deepEqual(s?.choices?.map(([c]) => Number(c)), [...PAGE_SIZES]);
  assert.ok(s?.choices?.some(([c]) => c === s.def));
});
