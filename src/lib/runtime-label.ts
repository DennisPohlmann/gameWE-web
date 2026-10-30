// Where a gameWE part runs (lib/runtime.ts for the web, hlstats_Options
// gamewe_collector_runtime for the collector), for the admin menu.
export type Runtime = "docker" | "container" | null;

// The stored value of the collector; anything else counts as none.
export function parseRuntime(v: string | null | undefined): Runtime {
  const s = (v ?? "").trim();
  return s === "docker" || s === "container" ? s : null;
}

// " (Docker)", " (Container)" or "" after a version.
export function runtimeSuffix(r: Runtime): string {
  return r === "docker" ? " (Docker)" : r === "container" ? " (Container)" : "";
}
