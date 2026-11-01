import "server-only";
import { adminQuery } from "./db";
import { heartbeatFresh, parseNext } from "./job-plan";
import { parseRuntime, type Runtime } from "./runtime-label";

// What the website knows about the collector, all from what the collector
// itself writes: gamewe_heartbeat (Unix time, every minute),
// gamewe_collector_version and gamewe_collector_runtime in hlstats_Options
// and the schema versions in hlstats_gamewe_schema_migrations. Read only;
// the admin menu shows the state, /admin/collector the details.

export type CollectorState = "ok" | "stale" | "never";
export type CollectorStatus = { heartbeat: number; state: CollectorState; version: string | null; runtime: Runtime };

export function collectorState(heartbeat: number, now: number): CollectorState {
  return heartbeatFresh(heartbeat, now) ? "ok" : heartbeat > 0 ? "stale" : "never";
}

export async function collectorStatus(): Promise<CollectorStatus> {
  let o = new Map<string, string>();
  try {
    const rows = await adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [
      ["gamewe_heartbeat", "gamewe_collector_version", "gamewe_collector_runtime"],
    ]);
    o = new Map(rows.map((r) => [r.keyname, (r.value ?? "").trim()]));
  } catch {
    // No database: shown as never seen.
  }
  const heartbeat = parseNext(o.get("gamewe_heartbeat"));
  return {
    heartbeat,
    state: collectorState(heartbeat, Math.floor(Date.now() / 1000)),
    version: o.get("gamewe_collector_version")?.slice(0, 32) || null,
    runtime: parseRuntime(o.get("gamewe_collector_runtime")),
  };
}

// The newest schema version the collector applied, null when the table is
// missing or not readable for the admin database user.
export async function collectorSchema(): Promise<{ version: number; at: string | null } | null> {
  try {
    const rows = await adminQuery<{ version: number | string; applied: string | null }>(
      `SELECT MAX(version) AS version, MAX(applied_at) AS applied FROM hlstats_gamewe_schema_migrations`,
    );
    const v = Number(rows[0]?.version);
    return Number.isFinite(v) && v > 0 ? { version: v, at: rows[0]?.applied ? String(rows[0].applied) : null } : null;
  } catch {
    return null;
  }
}
