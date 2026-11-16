import "server-only";
import { jobOriginColumns } from "./admin-jobs";
import { OpError, who, type Actor } from "./admin-ops";
import { adminExec, adminInsert, adminQuery, upsert } from "./db";
import { webOriginDetail } from "./job-origin";
import { CHANNELS, EVENTS, TOKEN_CHANNELS, badOwn, joinNtfy, ownKey, ownTokenKey, ownValue, parseOwn, parseStatus, statusKey, tokenOk, userHash, type Channel, type NotifyEvent, type NotifyStatus, type Own, type TokenChannel } from "./notify-core";
import { collectorRunning, jobsAvailable } from "./reset";
import { deleteSecrets, saveSecret, secretsOf } from "./secret-options";

// What My account and the admin API show and change of an admin's own
// notifications (lib/notify-core.ts has the keys), test messages as
// collector jobs.

export type TestJob = { id: number; status: string; result: string; at: number };
// ready: the channel can send (e-mail: the site's SMTP server and sender;
// Telegram: the admin's bot token; ntfy always). token: an own token is
// stored (Telegram, ntfy).
export type OwnState = Own & { channel: Channel; ready: boolean; token: boolean; status: NotifyStatus; test: TestJob | null };
export type NotifyState = { own: OwnState[]; collector: boolean; jobs: boolean };
export type OwnTokens = Partial<Record<TokenChannel, string>>;

async function options(keys: string[]): Promise<Map<string, string>> {
  const rows = await adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [keys]);
  return new Map(rows.map((r) => [r.keyname, (r.value ?? "").trim()]));
}

// The latest test job per channel of one admin.
async function lastTests(hash: string): Promise<Map<string, TestJob>> {
  const out = new Map<string, TestJob>();
  try {
    const rows = await adminQuery<{ id: number; mode: string; status: string; result: string | null; requested_at: number }>(
      `SELECT id, mode, status, result, requested_at FROM hlstats_gamewe_jobs WHERE job_type = 'notify-test' AND game = ? ORDER BY id DESC LIMIT 20`,
      [hash],
    );
    for (const r of rows) if (!out.has(r.mode)) out.set(r.mode, { id: Number(r.id), status: r.status, result: r.result ?? "", at: Number(r.requested_at) });
  } catch {
    // no job table: no tests
  }
  return out;
}

// The admin's own notifications per channel.
export async function notifyState(user: string): Promise<NotifyState> {
  const hash = userHash(user);
  const keys = ["gamewe_notify_smtp_host", "gamewe_notify_email_from", ...CHANNELS.flatMap((c) => [ownKey(user, c), statusKey(c, hash)])];
  const [o, tok, mine, run, jobs] = await Promise.all([options(keys), secretsOf(TOKEN_CHANNELS.map((c) => ownTokenKey(user, c))), lastTests(hash), collectorRunning(), jobsAvailable()]);
  const has = (c: Channel) => (c === "telegram" || c === "ntfy") && !!tok[ownTokenKey(user, c)];
  const ready = (c: Channel) => (c === "email" ? !!o.get("gamewe_notify_smtp_host") && !!o.get("gamewe_notify_email_from") : c === "telegram" ? has(c) : true);
  return {
    own: CHANNELS.map((c) => ({ channel: c, ...parseOwn(o.get(ownKey(user, c))), ready: ready(c), token: has(c), status: parseStatus(o.get(statusKey(c, hash))), test: mine.get(c) ?? null })),
    collector: run.running,
    jobs,
  };
}

// Stores the admin's own addresses, events and tokens; a channel not in
// values stays. A bad address or token throws OpError("field", { field:
// <channel> }) before anything is written; an empty address removes the
// channel's row and its token. tokens: undefined keeps one, "" removes it.
export async function saveOwnNotify(a: Actor, values: Partial<Record<Channel, Own>>, tokens: OwnTokens = {}): Promise<void> {
  const user = a.user.username;
  const bad = badOwn(values) ?? TOKEN_CHANNELS.find((c) => tokens[c] && !tokenOk(c, tokens[c]!)) ?? null;
  if (bad) throw new OpError("field", { field: bad });
  for (const c of CHANNELS) {
    const v = values[c];
    if (!v) continue;
    const to = v.to.trim();
    if (!to) await adminExec(`DELETE FROM hlstats_Options WHERE keyname = ?`, [ownKey(user, c)]);
    else await adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [ownKey(user, c), ownValue({ to, events: v.events })]);
  }
  for (const c of TOKEN_CHANNELS) {
    if (tokens[c] === "" || values[c]?.to.trim() === "") await deleteSecrets([ownTokenKey(user, c)]);
    else if (tokens[c]) await saveSecret(ownTokenKey(user, c), tokens[c]!);
  }
  const what = [...Object.keys(values), ...TOKEN_CHANNELS.filter((c) => tokens[c] !== undefined).map((c) => `${c} token`)];
  if (a.via) console.info(`gameWE: own notifications changed (${what.join(", ")}) by ${who(a)}`);
}

// Queues a test message to the admin's own address. A test already
// waiting is returned.
export async function queueNotifyTest(a: Actor, channel: Channel): Promise<{ id: number; existing: boolean }> {
  if (!(await jobsAvailable())) throw new OpError("nojobs");
  const game = userHash(a.user.username);
  const [open] = await adminQuery<{ id: number }>(`SELECT id FROM hlstats_gamewe_jobs WHERE job_type = 'notify-test' AND game = ? AND mode = ? AND status IN ('pending', 'running') ORDER BY id LIMIT 1`, [game, channel]);
  if (open) return { id: Number(open.id), existing: true };
  const origin: Record<string, string> = (await jobOriginColumns()) ? { origin: a.via ? "api" : "admin", origin_detail: webOriginDetail(a.via) } : {};
  const id = await adminInsert(
    "hlstats_gamewe_jobs",
    { job_type: "notify-test", game, mode: channel, status: "pending", requested_by: a.user.username.slice(0, 64), requested_at: Math.floor(Date.now() / 1000), ...origin },
    "id",
  );
  if (a.via) console.info(`gameWE: notification test ${channel} queued by ${who(a)}`);
  return { id, existing: false };
}

// The own tokens of a form (notify_<c>_token, SecretControl): a channel
// left out keeps the stored one, "" (Remove ticked) deletes it.
export function ownTokensFromForm(form: Pick<FormData, "get">): OwnTokens {
  const out: OwnTokens = {};
  for (const c of TOKEN_CHANNELS) {
    const v = String(form.get(`notify_${c}_token`) ?? "").trim();
    if (form.get(`notify_${c}_token__clear`) === "1") out[c] = "";
    else if (v) out[c] = v;
  }
  return out;
}

// The own values of a form: per channel the address (notify_<c>; ntfy:
// notify_ntfy_server and notify_ntfy) and the checked events
// (notify_<c>_<event>).
export function ownFromForm(form: Pick<FormData, "get">): Record<Channel, Own> {
  const field = (k: string) => String(form.get(k) ?? "").trim();
  return Object.fromEntries(
    CHANNELS.map((c) => [c, { to: c === "ntfy" ? joinNtfy(field("notify_ntfy_server"), field("notify_ntfy")) : field(`notify_${c}`), events: EVENTS.filter((e) => form.get(`notify_${c}_${e}`) === "1") as NotifyEvent[] }]),
  ) as Record<Channel, Own>;
}
