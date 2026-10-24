// returnTo of the admin edit pages: only the list of the same entity with
// its known parameters comes back. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { addParams, listHref, safeReturnTo, withReturnTo } from "../src/lib/return-to.ts";

test("the list keeps ranking, search, page and rows", () => {
  const list = listHref("awards", { game: "css", q: "head shot", page: 3, rows: 100 });
  assert.equal(list, "/admin/awards?game=css&q=head+shot&page=3&rows=100");
  assert.equal(safeReturnTo(list, "awards"), list);
});

test("the edit link carries the list, the plain list adds nothing", () => {
  const list = listHref("awards", { game: "css" });
  assert.equal(withReturnTo("/admin/awards/7", list, "awards"), "/admin/awards/7?returnTo=%2Fadmin%2Fawards%3Fgame%3Dcss");
  assert.equal(withReturnTo("/admin/awards/7", "/admin/awards", "awards"), "/admin/awards/7");
  assert.equal(addParams("/admin/awards/7?returnTo=x", { saved: "1", msg: undefined }), "/admin/awards/7?returnTo=x&saved=1");
});

test("anything else falls back to the plain list", () => {
  for (const v of [
    null,
    undefined,
    1,
    "",
    "https://evil.example/admin/awards",
    "//evil.example/admin/awards",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/admin/users",
    "/admin/awards/../users",
    "/admin/awards/7",
    "/admin/awards\n?game=css",
    `/admin/awards?q=${"x".repeat(600)}`,
  ]) {
    assert.equal(safeReturnTo(v, "awards"), "/admin/awards", String(v));
  }
});

test("unknown parameters are dropped", () => {
  assert.equal(safeReturnTo("/admin/awards?game=css&next=//evil.example&deleted=1#x", "awards"), "/admin/awards?game=css");
});
