import "server-only";
import { adminQuery } from "./db";
import { parseJobOrigin, type JobOrigin } from "./job-origin";
import { PLAN_KEYS, nextResetKey, effectiveSchedule, parseBansPlan, parseNext, parsePlan, type BansPlan, type JobPlan } from "./job-plan";
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
  origin: JobOrigin; // which feature queued it and why
};

export type ScheduledRanking = { game: string; schedule: Schedule; mode: ResetMode; next: number };

export type JobsOverview = {
  heartbeat: number;
  awards: JobPlan | null;
  inactive: JobPlan | null;
  resets: JobPlan | null;
  bans: BansPlan | null; // the bans-sync job (collector "all-bans")
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
  origin: string | null;
  origin_detail: string | null;
};

const BASE_COLS = "id, job_type, game, mode, status, requested_by, requested_at, started_at, finished_at, result";

// Whether hlstats_gamewe_jobs has the columns origin and origin_detail
// (collector schema version 22); checked again every minute while it has
// not, so a migration of the collector shows without a restart of the web.
let originSeen = false;
let originChecked = 0;
export async function jobOriginColumns(): Promise<boolean> {
  if (originSeen || Date.now() - originChecked < 60_000) return originSeen;
  originChecked = Date.now();
  try {
    await adminQuery(`SELECT origin, origin_detail FROM hlstats_gamewe_jobs WHERE 1 = 0`);
    originSeen = true;
  } catch {
    originSeen = false;
  }
  return originSeen;
}

// The columns jobs are read with: without the origin columns they read as
// empty, so the rows look like jobs queued before them.
export async function jobCols(): Promise<string> {
  return `${BASE_COLS}, ${(await jobOriginColumns()) ? "origin, origin_detail" : "'' AS origin, '' AS origin_detail"}`;
}

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
    origin: parseJobOrigin(r.origin, r.origin_detail),
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
    const COLS = await jobCols();
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
    bans: parseBansPlan(o.get(PLAN_KEYS.bans)),
    rankings,
    queue,
    history,
    table,
  };
}

// One job by its id (admin API), undefined if there is none or no table.
export async function getAdminJob(id: number): Promise<Job | undefined> {
  try {
    const rows = await adminQuery<Row>(`SELECT ${await jobCols()} FROM hlstats_gamewe_jobs WHERE id = ?`, [id]);
    return rows[0] ? job(rows[0]) : undefined;
  } catch {
    return undefined;
  }
}
