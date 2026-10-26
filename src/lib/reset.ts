import "server-only";
import { adminInsert, adminQuery } from "./db";
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
};

const COLS = "id, game, mode, status, requested_by, requested_at, started_at, finished_at, result";
// The collector updates gamewe_heartbeat every 60 s.
const HEARTBEAT_MAX_AGE = 120;

export async function jobsAvailable(): Promise<boolean> {
  try {
    await adminQuery(`SELECT id FROM hlstats_gamewe_jobs WHERE 1 = 0`);
    return true;
  } catch {
    return false;
  }
}

export async function collectorRunning(): Promise<boolean> {
  try {
    const rows = await adminQuery<{ value: string }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, ["gamewe_heartbeat"]);
    const beat = Number(rows[0]?.value);
    return Number.isFinite(beat) && beat > 0 && Date.now() / 1000 - beat <= HEARTBEAT_MAX_AGE;
  } catch {
    return false;
  }
}

export async function openJob(game: string): Promise<ResetJob | undefined> {
  const rows = await adminQuery<ResetJob>(
    `SELECT ${COLS} FROM hlstats_gamewe_jobs WHERE job_type IN ('reset', 'scheduled-reset') AND game = ? AND status IN ('pending', 'running') ORDER BY id LIMIT 1`,
    [game],
  );
  return rows[0];
}

export async function getJob(id: number): Promise<ResetJob | undefined> {
  const rows = await adminQuery<ResetJob>(`SELECT ${COLS} FROM hlstats_gamewe_jobs WHERE id = ? AND job_type IN ('reset', 'scheduled-reset')`, [id]);
  return rows[0];
}

export async function recentJobs(limit = 10): Promise<ResetJob[]> {
  return adminQuery<ResetJob>(`SELECT ${COLS} FROM hlstats_gamewe_jobs WHERE job_type IN ('reset', 'scheduled-reset') ORDER BY id DESC LIMIT ${Math.max(1, Math.floor(limit))}`);
}

// Returns the new job id, or the id of the job already queued for that game.
export async function queueReset(game: string, mode: ResetMode, user: string): Promise<{ id: number; existing: boolean }> {
  const open = await openJob(game);
  if (open) return { id: open.id, existing: true };
  const id = await adminInsert(
    "hlstats_gamewe_jobs",
    {
      job_type: "reset",
      game,
      mode,
      status: "pending",
      requested_by: user.slice(0, 64),
      requested_at: Math.floor(Date.now() / 1000),
    },
    "id",
  );
  return { id, existing: false };
}
