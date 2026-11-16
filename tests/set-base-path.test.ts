// scripts/set-base-path.sh swaps the build's placeholder sub path for the real
// one. The proxy matcher in the manifests carries it escaped (\\/__gamewe_base__
// in JSON); for the root a lone "\" left there broke every page (HTTP 500).
// Run with `npm test`.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const matcher = String.raw`^\/__gamewe_base__(?:\/(_next\/data\/[^/]{1,}))?(?:\/((?!_next\/|api\/|-\/).*))(\.json|\.rsc|\.segments\/.+\.segment\.rsc)?[\/#\?]?$`;

for (const [base, page] of [["", "/css3/players/1"], ["/new", "/new/css3/players/1"], ["/a/b", "/a/b/css3"]]) {
  test(`set-base-path.sh "${base}" keeps the proxy matcher a working regex`, () => {
    const dir = mkdtempSync(join(tmpdir(), "base-path-"));
    try {
      mkdirSync(join(dir, ".next", "server"), { recursive: true });
      const manifest = join(dir, ".next", "server", "functions-config-manifest.json");
      writeFileSync(manifest, JSON.stringify({ regexp: matcher, basePath: "/__gamewe_base__" }));
      writeFileSync(join(dir, "server.js"), `const basePath = "/__gamewe_base__";`);
      execFileSync("sh", ["scripts/set-base-path.sh", base, dir]);
      const m = JSON.parse(readFileSync(manifest, "utf8")) as { regexp: string; basePath: string };
      assert.equal(m.basePath, base);
      assert.ok(new RegExp(m.regexp).test(page));
      assert.ok(!new RegExp(m.regexp).test(`${base}/_next/static/x.js`));
      assert.equal(readFileSync(join(dir, "server.js"), "utf8"), `const basePath = "${base}";`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
