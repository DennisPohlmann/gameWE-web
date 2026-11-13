// The translation of the queries to T-SQL for SQL Server (src/lib/mssql-sql.ts).
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { toMssql } from "../src/lib/mssql-sql.ts";

test("placeholders become numbered parameters, arrays lists", () => {
  assert.deepEqual(toMssql("SELECT a FROM t WHERE b = ? AND c IN (?) AND d = '?'", [1, [2, 3]]), {
    text: "SELECT a FROM t WHERE b = @p1 AND c IN (@p2, @p3) AND d = '?'",
    values: [1, 2, 3],
  });
  assert.equal(toMssql("SELECT a FROM t WHERE c IN (?)", [[]]).text, "SELECT a FROM t WHERE c IN (NULL)");
  assert.throws(() => toMssql("SELECT ?", []));
  assert.throws(() => toMssql("SELECT 1", [1]));
});

test("LIMIT becomes OFFSET ... FETCH", () => {
  assert.equal(toMssql("SELECT a FROM t ORDER BY a LIMIT 10", []).text, "SELECT a FROM t ORDER BY a OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY");
  assert.equal(toMssql("SELECT a FROM t WHERE x = ? LIMIT 1", [5]).text,
    "SELECT a FROM t WHERE x = @p1 ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY");
  const r = toMssql("SELECT a FROM t ORDER BY a LIMIT ? OFFSET ?", [20, 40]);
  assert.equal(r.text, "SELECT a FROM t ORDER BY a OFFSET @p2 ROWS FETCH NEXT @p1 ROWS ONLY");
  assert.deepEqual(r.values, [20, 40]);
  assert.equal(toMssql("SELECT (SELECT b FROM u WHERE u.a = t.a LIMIT 1) FROM t ORDER BY a", []).text,
    "SELECT (SELECT b FROM u WHERE u.a = t.a ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY) FROM t ORDER BY a");
  assert.equal(toMssql("(SELECT a FROM t ORDER BY 1 DESC LIMIT 5) UNION ALL (SELECT a FROM u ORDER BY 1 DESC LIMIT 5)", []).text,
    "(SELECT a FROM t ORDER BY 1 DESC OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY) UNION ALL (SELECT a FROM u ORDER BY 1 DESC OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY)");
});

test("LIMIT 0 gives no rows (FETCH NEXT 0 is an error)", () => {
  assert.equal(toMssql("SELECT a FROM t ORDER BY a LIMIT ? OFFSET ?", [0, 10]).text,
    "SELECT a FROM t ORDER BY a OFFSET 9223372036854775806 ROWS FETCH NEXT 1 ROWS ONLY");
  assert.equal(toMssql("SELECT a FROM t LIMIT 0", []).text, "SELECT a FROM t ORDER BY (SELECT NULL) OFFSET 9223372036854775806 ROWS FETCH NEXT 1 ROWS ONLY");
});

test("a key repeated in ORDER BY is left out", () => {
  assert.equal(toMssql("SELECT a FROM t ORDER BY h.date DESC, h.date DESC, a.name, A.Name ASC, a.id LIMIT 5", []).text,
    "SELECT a FROM t ORDER BY h.date DESC, a.name, a.id OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY");
  assert.equal(toMssql("SELECT (SELECT b FROM u ORDER BY x, x LIMIT 1) FROM t ORDER BY a, b", []).text,
    "SELECT (SELECT b FROM u ORDER BY x OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY) FROM t ORDER BY a, b");
  assert.equal(toMssql("SELECT a, ROW_NUMBER() OVER (ORDER BY s DESC, s DESC) FROM t ORDER BY 'x, x'", []).text,
    "SELECT a, ROW_NUMBER() OVER (ORDER BY s DESC) FROM t ORDER BY 'x, x'");
});

test("functions, booleans, backticks", () => {
  assert.equal(toMssql("SELECT `key`, IFNULL(a, 0), LENGTH(b), ROUND(c), ROUND(d, 2) FROM t WHERE ok = TRUE", []).text,
    "SELECT [key], COALESCE(a, 0), LEN(b), ROUND(c, 0), ROUND(d, 2) FROM t WHERE ok = 1");
  assert.equal(toMssql("SELECT AVG(IFNULL(x, 0)), ROUND(AVG(y)) FROM t", []).text,
    "SELECT AVG(CAST(COALESCE(x, 0) AS float)), ROUND(AVG(CAST(y AS float)), 0) FROM t");
  assert.equal(toMssql("SELECT 'LIMIT 1' -- LIMIT 2\nFROM t", []).text, "SELECT 'LIMIT 1' -- LIMIT 2\nFROM t");
});
