import "server-only";
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { env } from "./env";
import { query } from "./db";

// Health endpoints after GitLab's: /-/health, /-/liveness, /-/readiness and
// /-/metrics (Prometheus). They show no addresses, names or settings.

export const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

// The database answers within 3 seconds.
export async function databaseUp(): Promise<{ up: boolean; seconds: number }> {
  const start = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      query(`SELECT 1`),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 3000);
      }),
    ]);
    return { up: true, seconds: (performance.now() - start) / 1000 };
  } catch {
    return { up: false, seconds: (performance.now() - start) / 1000 };
  } finally {
    clearTimeout(timer);
  }
}

export function inDocker() {
  return process.env.GAMEWE_DOCKER === "1" || existsSync("/.dockerenv");
}

// /-/metrics is off until a token is set: gamewe_metrics_token in the settings,
// else GAMEWE_METRICS_TOKEN in the environment (at least 16 characters).
// Prometheus sends it as "Authorization: Bearer <token>".
async function metricsToken(): Promise<string> {
  let stored = "";
  try {
    const rows = await query<{ value: string }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, ["gamewe_metrics_token"]);
    stored = rows[0]?.value?.trim() ?? "";
  } catch {
    // Database down: the environment alone.
  }
  return stored || (env("GAMEWE_METRICS_TOKEN") ?? "");
}

export async function metricsAccess(req: Request): Promise<"ok" | "off" | "denied"> {
  const token = await metricsToken();
  if (token.length < 16) return "off";
  const got = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1]?.trim() ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "denied";
}

const label = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

// Prometheus text format: app, process, database and per visible ranking the
// servers, players online and ranked players.
export async function metricsText(): Promise<string> {
  const db = await databaseUp();
  const mem = process.memoryUsage();
  const out: string[] = [];
  const metric = (name: string, help: string, type: "gauge" | "counter", rows: [string, number][]) => {
    out.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);
    for (const [labels, v] of rows) out.push(`${name}${labels} ${Number.isFinite(v) ? v : 0}`);
  };
  metric("gamewe_info", "Version of gameWE web.", "gauge", [[`{version="${label(process.env.APP_VERSION ?? "?")}",docker="${inDocker()}"}`, 1]]);
  metric("gamewe_up", "The web app answers.", "gauge", [["", 1]]);
  metric("gamewe_database_up", "The database answers within 3 seconds.", "gauge", [["", db.up ? 1 : 0]]);
  metric("gamewe_database_latency_seconds", "Time of a SELECT 1.", "gauge", [["", Math.round(db.seconds * 10000) / 10000]]);
  metric("process_uptime_seconds", "Seconds since the web process started.", "gauge", [["", Math.round(process.uptime())]]);
  metric("process_resident_memory_bytes", "Resident memory of the web process.", "gauge", [["", mem.rss]]);
  metric("nodejs_heap_used_bytes", "Used V8 heap.", "gauge", [["", mem.heapUsed]]);
  if (db.up) {
    try {
      const [servers, ranked] = await Promise.all([
        query<{ game: string; servers: number | string; online: number | string }>(
          `SELECT TRIM(s.game) AS game, COUNT(*) AS servers,
                  SUM(CASE WHEN s.max_players > 0 AND s.act_players > s.max_players THEN s.max_players ELSE s.act_players END) AS online
           FROM hlstats_Servers s JOIN hlstats_Games g ON g.code = s.game AND g.hidden = '0'
           GROUP BY TRIM(s.game)`,
        ),
        query<{ game: string; n: number | string }>(
          `SELECT TRIM(p.game) AS game, COUNT(*) AS n
           FROM hlstats_Players p JOIN hlstats_Games g ON g.code = p.game AND g.hidden = '0'
           WHERE p.hideranking = 0 GROUP BY TRIM(p.game)`,
        ),
      ]);
      const g = (code: string) => `{game="${label(code)}"}`;
      metric("gamewe_servers", "Servers per ranking.", "gauge", servers.map((r) => [g(r.game), Number(r.servers)]));
      metric("gamewe_players_online", "Players online per ranking.", "gauge", servers.map((r) => [g(r.game), Number(r.online ?? 0)]));
      metric("gamewe_players_ranked", "Players in the ranking (not hidden) per ranking.", "gauge", ranked.map((r) => [g(r.game), Number(r.n)]));
    } catch {
      // Only the process values when the queries fail.
    }
  }
  return `${out.join("\n")}\n`;
}
