// The Helm chart (charts/gamewe-web) always has the web's version: every
// release sets it (semantic-release), CI lints and publishes it.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const chart = readFileSync("charts/gamewe-web/Chart.yaml", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

test("Chart.yaml has the version of the web", () => {
  assert.equal(chart.match(/^version: (.+)$/m)?.[1], pkg.version);
  assert.equal(chart.match(/^appVersion: "(.+)"$/m)?.[1], pkg.version);
  assert.equal(readFileSync("VERSION", "utf8").trim(), pkg.version);
});

test("every release sets the chart's version and commits it", () => {
  const rc = JSON.parse(readFileSync(".releaserc.json", "utf8")) as { plugins: [string, Record<string, unknown>][] };
  const exec = rc.plugins.find((p) => p[0] === "@semantic-release/exec")?.[1] as { prepareCmd: string };
  assert.match(exec.prepareCmd, /sed -i -E "s\/\^version: \.\*\/version: \$\{nextRelease\.version\}\/; s\/\^appVersion: \.\*\/appVersion: \\"\$\{nextRelease\.version\}\\"\/" charts\/gamewe-web\/Chart\.yaml/);
  const git = rc.plugins.find((p) => p[0] === "@semantic-release/git")?.[1] as { assets: string[] };
  assert.ok(git.assets.includes("charts/gamewe-web/Chart.yaml"));
});

test("CI lints the chart and publishes it with a release", () => {
  const wf = readFileSync(".github/workflows/build.yml", "utf8");
  assert.match(wf, /helm lint charts\/gamewe-web --strict/);
  assert.match(wf, /helm push "dist\/gamewe-web-\$RELEASE\.tgz" "oci:\/\/ghcr\.io\/\$\{GITHUB_REPOSITORY_OWNER,,\}\/charts"/);
  assert.match(wf, /gh release upload "v\$RELEASE" "dist\/gamewe-web-\$RELEASE\.tgz"/);
});

test("the chart runs the image as its user, without secrets in the values", () => {
  const values = readFileSync("charts/gamewe-web/values.yaml", "utf8");
  assert.match(values, /repository: ghcr\.io\/dennispohlmann\/gamewe-web/);
  assert.match(values, /runAsNonRoot: true/);
  assert.match(values, /secretEnv: \{\}/);
  assert.doesNotMatch(values, /^\s+(DB_PASSWORD|ADMIN_SECRET|DB_ADMIN_PASSWORD):/m);
  const dep = readFileSync("charts/gamewe-web/templates/deployment.yaml", "utf8");
  assert.match(dep, /\.Values\.image\.tag \| default \.Chart\.AppVersion/);
  assert.match(dep, /secretRef:/);
});
