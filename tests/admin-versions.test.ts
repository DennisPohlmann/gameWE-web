// The admin menu shows "gameWE Web vX (Docker)" and "gameWE Collector vY
// (Container)": where each part runs, in brackets, nothing on the host. The
// collector reports its own in hlstats_Options gamewe_collector_runtime.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseRuntime, runtimeSuffix } from "../src/lib/runtime-label.ts";

test("the brackets after a version", () => {
  assert.equal(runtimeSuffix("docker"), " (Docker)");
  assert.equal(runtimeSuffix("container"), " (Container)");
  assert.equal(runtimeSuffix(null), "");
});

test("the collector's stored value", () => {
  assert.equal(parseRuntime("docker"), "docker");
  assert.equal(parseRuntime(" container\n"), "container");
  for (const v of ["", null, undefined, "Docker", "<b>x</b>"]) assert.equal(parseRuntime(v), null);
});

test("the menu names both parts with their runtime", () => {
  const layout = readFileSync("src/app/admin/(panel)/layout.tsx", "utf8");
  assert.match(layout, /`gameWE Web \$\{web \? `v\$\{web\}` : "\?"\}\$\{runtimeSuffix\(webRuntime\(\)\)\}`/);
  assert.match(layout, /`gameWE Collector v\$\{status\.collector\.slice\(0, 32\)\}\$\{runtimeSuffix\(status\.collectorRuntime\)\}`/);
  assert.doesNotMatch(layout, /noDocker/);
  const updates = readFileSync("src/lib/updates.ts", "utf8");
  assert.match(updates, /"gamewe_collector_runtime"/);
  // Kubernetes and Podman before Docker: they may run the Docker image.
  const rt = readFileSync("src/lib/runtime.ts", "utf8");
  assert.ok(rt.indexOf('return "container"') < rt.indexOf('return "docker"'));
});
