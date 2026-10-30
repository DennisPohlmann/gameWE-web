import "server-only";
import { jobCols, jobOriginColumns } from "./admin-jobs";
import { adminInsert, adminQuery } from "./db";
import { parseJobOrigin, webOriginDetail, type JobOrigin } from "./job-origin";
import { heartbeatFresh, parseNext } from "./job-plan";
import type { ResetMode } from "./reset-modes";

// Reset of one ranking through the running collector (collector 0.1.0,
// table from its init script). The web only queues a job in hlstats_gamewe_jobs and shows
// its state; the collector pauses the servers of that game, drops its
// in-memory players and runs the reset itself. The web user may only SELECT
// and INSERT on the job table.

export { RESET_MODES, jobModeName, resetMode, type ResetMode } from "./reset-modes";

export type ResetJob = {
  id: number;
  game: string;
  mode: string;
  status: string;
  requested_by: string;
  requested_at: number;
  started_at: number | null;
  finished_at: number | null;
  result: string | null;
  origin: string | null;
  origin_detail: string | null;
};

// The origin of a reset job (which feature queued it and why).
export const resetOrigin = (j: ResetJob): JobOrigin => parseJobOrigin(j.origin, j.origin_detail);

export async function jobsAvailable(): Promise<boolean> {
  try {
    await adminQuery(`SELECT id FROM hlstats_gamewe_jobs WHERE 1 = 0`);
    return true;
  } catch {
    return false;
  }
}

// Whether the collector runs (its heartbeat is fresh) and its last
// heartbeat (Unix time, 0: none or not readable).
export async function collectorRunning(): Promise<{ running: boolean; beat: number }> {
  try {
    const rows = await adminQuery<{ value: string }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, ["gamewe_heartbeat"]);
    const beat = parseNext(rows[0]?.value);
    return { running: heartbeatFresh(beat, Date.now() / 1000), beat };
  } catch {
    return { running: false, beat: 0 };
  }
}

export async function openJob(game: string): Promise<ResetJob | undefined> {
  const rows = await adminQuery<ResetJob>(
    `SELECT ${await jobCols()} FROM hlstats_gamewe_jobs WHERE job_type IN ('reset', 'scheduled-reset') AND game = ? AND status IN ('pending', 'running') ORDER BY id LIMIT 1`,
    [game],
  );
  return rows[0];
}

export async function getJob(id: number): Promise<ResetJob | undefined> {
  const rows = await adminQuery<ResetJob>(`SELECT ${await jobCols()} FROM hlstats_gamewe_jobs WHERE id = ? AND job_type IN ('reset', 'scheduled-reset')`, [id]);
  return rows[0];
}

export async function recentJobs(limit = 10): Promise<ResetJob[]> {
  return adminQuery<ResetJob>(`SELECT ${await jobCols()} FROM hlstats_gamewe_jobs WHERE job_type IN ('reset', 'scheduled-reset') ORDER BY id DESC LIMIT ${Math.max(1, Math.floor(limit))}`);
}

// Returns the new job id, or the id of the job already queued for that game.
// token: the name of the API token it came through (origin api), else the
// web admin (origin admin); stored with a collector that has the columns.
export async function queueReset(game: string, mode: ResetMode, user: string, token?: string): Promise<{ id: number; existing: boolean }> {
  const open = await openJob(game);
  if (open) return { id: open.id, existing: true };
  const origin: Record<string, string> = (await jobOriginColumns()) ? { origin: token ? "api" : "admin", origin_detail: webOriginDetail(token) } : {};
  const id = await adminInsert(
    "hlstats_gamewe_jobs",
    {
      job_type: "reset",
      game,
      mode,
      status: "pending",
      requested_by: user.slice(0, 64),
      requested_at: Math.floor(Date.now() / 1000),
      ...origin,
    },
    "id",
  );
  return { id, existing: false };
}
