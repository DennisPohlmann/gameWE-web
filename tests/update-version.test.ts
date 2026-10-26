// Update check of the admin area: versions and GitHub's release answer.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { REPOS, isNewer, parseRelease, parseVersion } from "../src/lib/update-version.ts";

test("versions are x.y.z with an optional v and suffix", () => {
  assert.deepEqual(parseVersion("v0.19.0"), [0, 19, 0]);
  assert.deepEqual(parseVersion("1.2.3-rc.1"), [1, 2, 3]);
  for (const v of ["dev", "?", "", null, undefined, "1.2", "1.2.3.4"]) assert.equal(parseVersion(v), null);
});

test("only a higher release is an update", () => {
  assert.equal(isNewer("0.20.0", "0.19.0"), true);
  assert.equal(isNewer("0.19.1", "0.19.0"), true);
  assert.equal(isNewer("1.0.0", "0.99.9"), true);
  assert.equal(isNewer("0.10.0", "0.9.0"), true);
  assert.equal(isNewer("0.19.0", "0.19.0"), false);
  assert.equal(isNewer("0.18.9", "0.19.0"), false);
  assert.equal(isNewer("0.20.0", "dev"), false);
  assert.equal(isNewer("0.20.0", null), false);
});

test("the release answer gives the version and a github.com release link only", () => {
  const repo = REPOS.web;
  assert.deepEqual(parseRelease(repo, { tag_name: "v0.20.0", html_url: `https://github.com/${repo}/releases/tag/v0.20.0` }), {
    version: "0.20.0",
    url: `https://github.com/${repo}/releases/tag/v0.20.0`,
  });
  for (const html_url of ["https://evil.example/x", `https://github.com/${repo}/releases/tag/v0.20.0"><script>`, `javascript:alert(1)`, 5]) {
    assert.equal(parseRelease(repo, { tag_name: "v0.20.0", html_url })?.url, `https://github.com/${repo}/releases/tag/v0.20.0`);
  }
  for (const body of [null, "x", {}, { tag_name: "nightly" }, { tag_name: 3 }]) assert.equal(parseRelease(repo, body), null);
});
