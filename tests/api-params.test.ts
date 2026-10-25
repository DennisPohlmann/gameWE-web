// Query parameters and paging of the public API. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, countryArg, dayArg, intArg, pagingArg, paged, pathId, sortArg, sortRows, textArg } from "../src/lib/api-params.ts";

const q = (s: string) => new URLSearchParams(s);
const refused = (f: () => unknown) => assert.throws(f, (e: unknown) => e instanceof ApiError && e.status === 400);

test("paging defaults to page 1 with 25 entries", () => {
  assert.deepEqual(pagingArg(q("")), { page: 1, limit: 25, offset: 0 });
  assert.deepEqual(pagingArg(q("page=3&limit=100")), { page: 3, limit: 100, offset: 200 });
  assert.deepEqual(pagingArg(q("offset=30&limit=10")), { page: 4, limit: 10, offset: 30 });
});

test("limit outside 1-100, junk and mixing page with offset are refused", () => {
  for (const s of ["limit=0", "limit=101", "limit=abc", "limit=-1", "limit=1.5", "limit=", "limit=1e2", "page=0", "page=x", "offset=-5", "offset=99999999", "page=2&offset=10"]) refused(() => pagingArg(q(s)));
});

test("integer, country, day and text parameters are checked", () => {
  assert.equal(intArg(q("days=7"), "days", 30, 1, 90), 7);
  assert.equal(intArg(q(""), "days", 30, 1, 90), 30);
  refused(() => intArg(q("days=91"), "days", 30, 1, 90));
  assert.equal(countryArg(q("country=DE")), "de");
  assert.equal(countryArg(q("")), "");
  for (const s of ["country=deu", "country=d1", "country=de'"]) refused(() => countryArg(q(s)));
  assert.equal(dayArg(q("day=2026-02-28")), "2026-02-28");
  for (const s of ["day=2026-02-30", "day=26-1-1", "day=today"]) refused(() => dayArg(q(s)));
  assert.equal(textArg(q("q=%20Bob%20"), "q", 64), "Bob");
  refused(() => textArg(q(`q=${"x".repeat(65)}`), "q", 64));
  refused(() => textArg(q("q=a%00b"), "q", 64));
});

test("sort takes only listed fields; names ascend, numbers descend", () => {
  const keys = ["skill", "name"] as const;
  assert.deepEqual(sortArg(q(""), keys, "skill", ["name"]), { sort: "skill", asc: false });
  assert.deepEqual(sortArg(q("sort=name"), keys, "skill", ["name"]), { sort: "name", asc: true });
  assert.deepEqual(sortArg(q("sort=name&order=desc"), keys, "skill", ["name"]), { sort: "name", asc: false });
  refused(() => sortArg(q("sort=p.skill;DROP"), keys, "skill"));
  refused(() => sortArg(q("order=up"), keys, "skill"));
});

test("path ids are positive digits only", () => {
  assert.equal(pathId("42"), 42);
  for (const s of ["0", "-1", "1e3", "abc", "12345678901", " 4"]) assert.equal(pathId(s), null);
});

test("pagination and links of a list", () => {
  const r = paged([1, 2], 51, { page: 2, limit: 25, offset: 25 }, "/api/v1/x", { country: "de", sort: undefined });
  assert.deepEqual(r.pagination, { page: 2, limit: 25, offset: 25, total: 51, totalPages: 3 });
  assert.deepEqual(r.links, {
    self: "/api/v1/x?country=de&page=2",
    first: "/api/v1/x?country=de",
    prev: "/api/v1/x?country=de",
    next: "/api/v1/x?country=de&page=3",
    last: "/api/v1/x?country=de&page=3",
  });
  const empty = paged([], 0, { page: 1, limit: 10, offset: 0 }, "/x");
  assert.deepEqual(empty.pagination.totalPages, 1);
  assert.equal(empty.links.next, null);
  assert.equal(empty.links.prev, null);
  assert.equal(empty.links.self, "/x?limit=10");
  // Past the end: prev points to the last page.
  assert.equal(paged([], 5, { page: 9, limit: 25, offset: 200 }, "/x").links.prev, "/x");
  assert.equal(paged([], 60, { page: 2, limit: 25, offset: 30 }, "/x").links.self, "/x?offset=30");
});

test("in-memory lists sort with a stable tie-break", () => {
  const rows = [{ id: 2, n: 5 }, { id: 1, n: 5 }, { id: 3, n: 9 }];
  assert.deepEqual(sortRows(rows, (r) => r.n, false, (r) => r.id).map((r) => r.id), [3, 1, 2]);
  assert.deepEqual(sortRows(rows, (r) => r.n, true, (r) => r.id).map((r) => r.id), [1, 2, 3]);
});

test("sort aliases map to their key; unknown sorts list the aliases too", () => {
  const keys = ["skill", "name", "kills"] as const;
  assert.deepEqual(sortArg(q("sort=points"), keys, "skill", ["name"], { points: "skill" }), { sort: "skill", asc: false });
  assert.deepEqual(sortArg(q("sort=points&order=asc"), keys, "skill", ["name"], { points: "skill" }), { sort: "skill", asc: true });
  assert.deepEqual(sortArg(q("sort=name"), keys, "skill", ["name"], { points: "skill" }), { sort: "name", asc: true });
  assert.throws(
    () => sortArg(q("sort=pts"), keys, "skill", [], { points: "skill" }),
    (e: unknown) => e instanceof ApiError && e.status === 400 && e.message === "invalid sort: one of skill, name, kills, points",
  );
  // Inherited names are no alias.
  for (const s of ["constructor", "__proto__", "toString"]) refused(() => sortArg(q(`sort=${s}`), keys, "skill", [], { points: "skill" }));
});
