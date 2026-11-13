// The admin area recognises "no right" and "duplicate key" on every database
// (src/lib/admin-data.ts), SQL Server by its error numbers. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = readFileSync("src/lib/admin-data.ts", "utf8");

test("duplicate key: MariaDB, PostgreSQL and SQL Server (2601, 2627)", () => {
  assert.match(src, /code === "ER_DUP_ENTRY" \|\| code === "23505" \|\| number === 2601 \|\| number === 2627/);
});

test("no right: MariaDB, PostgreSQL and SQL Server (229, 230)", () => {
  assert.match(src, /code === "42501" \|\| number === 229 \|\| number === 230/);
});
