// Third-party licenses: the generated npm list (src/lib/npm-licenses.json,
// scripts/licenses.mjs) is current, every license fits GPL-3.0-or-later,
// and THIRD-PARTY-LICENSES.md names each package with its version.
// Run with `npm test` (after `npm ci`).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = process.cwd();
const list = JSON.parse(readFileSync("src/lib/npm-licenses.json", "utf8")) as { name: string; version: string; license: string; platform?: boolean }[];

test("the npm list matches package-lock.json", () => {
  execFileSync(process.execPath, ["scripts/licenses.mjs", "--check"], { cwd: root, stdio: "pipe" });
});

// Licenses usable in a GPL-3.0-or-later program (an expression with AND
// needs every part).
const OK = new Set(["MIT", "ISC", "0BSD", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "MPL-2.0", "LGPL-3.0-or-later", "CC-BY-4.0"]);

test("every npm license is known and compatible", () => {
  for (const r of list) {
    const parts = r.license.replace(/[()]/g, "").split(/\s+AND\s+/);
    assert.ok(parts.every((p) => OK.has(p)), `${r.name}@${r.version}: ${r.license}`);
  }
});

test("THIRD-PARTY-LICENSES.md lists every installed package with its version", () => {
  const md = readFileSync("THIRD-PARTY-LICENSES.md", "utf8");
  for (const r of list) {
    if (r.platform) continue;
    assert.ok(md.includes(`| ${r.name} | ${r.version} |`) || md.includes(`${r.name} ${r.version}`) || md.includes(`\`${r.name}\` ${r.version}`), `${r.name} ${r.version} missing in THIRD-PARTY-LICENSES.md`);
  }
});
