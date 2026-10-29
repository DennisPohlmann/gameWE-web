import "server-only";
import { adminQuery } from "./db";
import { PLAN_KEYS, nextResetKey, effectiveSchedule, parseNext, parsePlan, type JobPlan } from "./job-plan";
import type { Schedule } from "./hall-period";
import { resetMode, type ResetMode } from "./reset-modes";

// What the admin page Jobs shows: the plan the collector writes into
// hlstats_Options, the rankings with a reset schedule and the rows of
// hlstats_gamewe_jobs. Read only.

export type Job = {
  id: number;
  type: string;
  game: string;
  mode: string;
  status: string;
  requestedBy: string;
  requestedAt: number;
  startedAt: number;
  finishedAt: number;
  result: string;
};

export type ScheduledRanking = { game: string; schedule: Schedule; mode: ResetMode; next: number };

export type JobsOverview = {
  heartbeat: number;
  awards: JobPlan | null;
  inactive: JobPlan | null;
  resets: JobPlan | null;
  rankings: ScheduledRanking[];
  queue: Job[];
  history: Job[];
  table: boolean; // hlstats_gamewe_jobs exists
};

type Row = {
  id: number;
  job_type: string;
  game: string;
  mode: string;
  status: string;
  requested_by: string;
  requested_at: number;
  started_at: number | null;
  finished_at: number | null;
  result: string | null;
};

const COLS = "id, job_type, game, mode, status, requested_by, requested_at, started_at, finished_at, result";

function job(r: Row): Job {
  return {
    id: Number(r.id),
    type: r.job_type,
    game: (r.game ?? "").trim(),
    mode: r.mode ?? "",
    status: r.status,
    requestedBy: r.requested_by ?? "",
    requestedAt: Number(r.requested_at ?? 0),
    startedAt: Number(r.started_at ?? 0),
    finishedAt: Number(r.finished_at ?? 0),
    result: r.result ?? "",
  };
}

export async function jobsOverview(games: string[], historyLimit = 30): Promise<JobsOverview> {
  const keys = ["gamewe_heartbeat", "gamewe_reset_schedule", "gamewe_reset_mode", ...Object.values(PLAN_KEYS)];
  for (const g of games) keys.push(`gamewe_reset_schedule_${g}`, `gamewe_reset_mode_${g}`, nextResetKey(g));
  const opts = await adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [keys]);
  const o = new Map(opts.map((r) => [r.keyname, (r.value ?? "").trim()]));
  const rankings: ScheduledRanking[] = [];
  for (const game of games) {
    const own = o.get(`gamewe_reset_schedule_${game}`);
    const schedule = effectiveSchedule(own, o.get("gamewe_reset_schedule"));
    if (!schedule) continue;
    const mode = resetMode(own ? o.get(`gamewe_reset_mode_${game}`) : o.get("gamewe_reset_mode")) ?? "player-stats";
    rankings.push({ game, schedule, mode, next: parseNext(o.get(nextResetKey(game))) });
  }
  let queue: Job[] = [];
  let history: Job[] = [];
  let table = true;
  try {
    const limit = Math.max(1, Math.floor(historyLimit));
    [queue, history] = await Promise.all([
      adminQuery<Row>(`SELECT ${COLS} FROM hlstats_gamewe_jobs WHERE status IN ('pending', 'running') ORDER BY id`).then((r) => r.map(job)),
      adminQuery<Row>(`SELECT ${COLS} FROM hlstats_gamewe_jobs WHERE status NOT IN ('pending', 'running') ORDER BY id DESC LIMIT ${limit}`).then((r) => r.map(job)),
    ]);
  } catch {
    table = false;
  }
  return {
    heartbeat: parseNext(o.get("gamewe_heartbeat")),
    awards: parsePlan(o.get(PLAN_KEYS.awards)),
    inactive: parsePlan(o.get(PLAN_KEYS.inactive)),
    resets: parsePlan(o.get(PLAN_KEYS.resets)),
    rankings,
    queue,
    history,
    table,
  };
}

// One job by its id (admin API), undefined if there is none or no table.
export async function getAdminJob(id: number): Promise<Job | undefined> {
  try {
    const rows = await adminQuery<Row>(`SELECT ${COLS} FROM hlstats_gamewe_jobs WHERE id = ?`, [id]);
    return rows[0] ? job(rows[0]) : undefined;
  } catch {
    return undefined;
  }
}
