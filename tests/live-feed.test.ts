// The `?since=` and `?seen=` of the live feeds: nothing new means 204
// without a body. Run with `npm test` (node --test, Node's built-in type
// stripping).
import assert from "node:assert/strict";
import { test } from "node:test";
import { newerWith, newestOf, noContent, nothingNew, sinceParam } from "../src/lib/live-feed.ts";

test("since and seen are read as numbers, anything else means everything", () => {
  assert.deepEqual(sinceParam("http://x/css/events-feed?since=1700000000&seen=2"), { since: 1700000000, seen: 2 });
  assert.deepEqual(sinceParam("http://x/css/events-feed?since=1700000000"), { since: 1700000000, seen: 0 });
  assert.deepEqual(sinceParam("http://x/css/events-feed"), { since: 0, seen: 0 });
  for (const v of ["", "-5", "12345678901", "abc", "1.5"]) assert.equal(sinceParam(`http://x/f?since=${v}`).since, 0);
});

test("the newest second of rows and how many share it", () => {
  assert.deepEqual(newestOf([]), { ts: 0, n: 0 });
  assert.deepEqual(newestOf([{ ts: 100 }, { ts: 90 }, { ts: 100 }]), { ts: 100, n: 2 });
  assert.deepEqual(newerWith({ ts: 100, n: 2 }, [{ ts: 100 }]), { ts: 100, n: 3 });
  assert.deepEqual(newerWith({ ts: 100, n: 2 }, [{ ts: 101 }, { ts: 100 }]), { ts: 101, n: 1 });
  assert.deepEqual(newerWith({ ts: 100, n: 2 }, [{ ts: 99 }]), { ts: 100, n: 2 });
  assert.deepEqual(newerWith({ ts: 100, n: 2 }, []), { ts: 100, n: 2 });
});

test("nothing new: no newer row and no more rows of the same second than seen", () => {
  const rows = [{ ts: 100 }, { ts: 100 }, { ts: 90 }];
  assert.equal(nothingNew(rows, { since: 100, seen: 2 }), true);
  assert.equal(nothingNew(rows, { since: 100, seen: 3 }), true);
  assert.equal(nothingNew(rows, { since: 100, seen: 1 }), false);
  assert.equal(nothingNew(rows, { since: 101, seen: 0 }), true);
  assert.equal(nothingNew(rows, { since: 99, seen: 5 }), false);
  assert.equal(nothingNew([], { since: 100, seen: 0 }), true);
});

test("without since everything is sent, even nothing", () => {
  assert.equal(nothingNew([], { since: 0, seen: 0 }), false);
  assert.equal(nothingNew([{ ts: 100 }], { since: 0, seen: 0 }), false);
});

test("the empty answer has no body and is not cached", () => {
  const r = noContent();
  assert.equal(r.status, 204);
  assert.equal(r.body, null);
  assert.equal(r.headers.get("cache-control"), "no-store");
});
