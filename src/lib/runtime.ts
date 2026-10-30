import "server-only";
import { existsSync } from "node:fs";
import type { Runtime } from "./runtime-label";

// Where the web runs: "container" (Kubernetes, Podman's /run/.containerenv
// or its container variable), "docker" (the gameWE image sets GAMEWE_DOCKER,
// other Docker images have /.dockerenv) or null (directly on the host), as
// the collector decides its own (hlstats_Options gamewe_collector_runtime).
export function webRuntime(): Runtime {
  // Kubernetes and Podman first: they may run the Docker image too.
  if (process.env.KUBERNETES_SERVICE_HOST || process.env.container || existsSync("/run/.containerenv")) return "container";
  if (process.env.GAMEWE_DOCKER === "1" || existsSync("/.dockerenv")) return "docker";
  return null;
}
