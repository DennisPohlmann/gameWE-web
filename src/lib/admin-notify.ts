import "server-only";
import { allowed } from "./admin-perms";
import { jobOriginColumns } from "./admin-jobs";
import { OpError, who, type Actor } from "./admin-ops";
import { adminExec, adminInsert, adminQuery, upsert } from "./db";
import { webOriginDetail } from "./job-origin";
import { CHANNELS, EVENTS, badOwn, channelKey, ntfyTokenOk, ownKey, ownTokenKey, ownValue, parseOwn, parseStatus, sharedToKey, statusKey, userHash, type Channel, type NotifyEvent, type NotifyStatus, type Own } from "./notify-core";
import { collectorRunning, jobsAvailable } from "./reset";
import { deleteSecrets, saveSecret, secretOptions, secretsOf } from "./secret-options";

// What the notifications pages and the admin API show and change
// (lib/notify-core.ts has the keys): the channels, the shared recipients'
// and the admin's own state, test messages as collector jobs.

export type TestJob = { id: number; status: string; result: string; at: number };
export type ChannelState = {
  channel: Channel;
  on: boolean; // turned on for the shared recipients
  ready: boolean; // the server is set up (e-mail: server and sender; Telegram: bot token); the admins' own need only this
  shared: boolean; // has shared recipients
  status: NotifyStatus; // last message to the shared recipients
  test: TestJob | null; // last test of the shared recipients
};
export type OwnState = Own & { channel: Channel; status: NotifyStatus; test: TestJob | null; token: boolean };
export type NotifyState = { channels: ChannelState[]; own: OwnState[]; collector: boolean; jobs: boolean };

const FIXED = ["gamewe_notify_smtp_host", "gamewe_notify_email_from", ...CHANNELS.flatMap((c) => [channelKey(c), sharedToKey[c], statusKey(c)])];

async function options(keys: string[]): Promise<Map<string, string>> {
  const rows = await adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [keys]);
  return new Map(rows.map((r) => [r.keyname, (r.value ?? "").trim()]));
}

// The latest test job per channel of the shared recipients (hash "") or
// of one admin.
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

// The state of every channel and, with user, that admin's own.
export async function notifyState(user?: string): Promise<NotifyState> {
  const hash = user ? userHash(user) : "";
  const own = user ? CHANNELS.flatMap((c) => [ownKey(user, c), statusKey(c, hash)]) : [];
  const [o, secrets, shared, mine, run, jobs, tok] = await Promise.all([
    options([...FIXED, ...own]),
    secretOptions(),
    lastTests(""),
    user ? lastTests(hash) : Promise.resolve(new Map()),
    collectorRunning(),
    jobsAvailable(),
    user ? secretsOf([ownTokenKey(user)]) : Promise.resolve({} as Record<string, string>),
  ]);
  const ready: Record<Channel, boolean> = {
    email: !!o.get("gamewe_notify_smtp_host") && !!o.get("gamewe_notify_email_from"),
    telegram: !!secrets.gamewe_notify_telegram_token,
    ntfy: true,
  };
  return {
    channels: CHANNELS.map((c) => ({ channel: c, on: o.get(channelKey(c)) === "1", ready: ready[c], shared: !!o.get(sharedToKey[c]), status: parseStatus(o.get(statusKey(c))), test: shared.get(c) ?? null })),
    own: user ? CHANNELS.map((c) => ({ channel: c, ...parseOwn(o.get(ownKey(user, c))), status: parseStatus(o.get(statusKey(c, hash))), test: mine.get(c) ?? null, token: c === "ntfy" && !!tok[ownTokenKey(user)] })) : [],
    collector: run.running,
    jobs,
  };
}

// Stores the admin's own addresses and events; a channel not in values
// stays. A bad address throws OpError("field", { field: <channel> }); an
// empty one removes the channel's row (ntfy: with the token). ntfyToken:
// undefined keeps it, "" removes it, else the new one.
export async function saveOwnNotify(a: Actor, values: Partial<Record<Channel, Own>>, ntfyToken?: string): Promise<void> {
  const user = a.user.username;
  const bad = badOwn(values) ?? (ntfyToken && !ntfyTokenOk(ntfyToken) ? "ntfy" : null); // a bad channel changes nothing
  if (bad) throw new OpError("field", { field: bad });
  if (ntfyToken === "" || values.ntfy?.to.trim() === "") await deleteSecrets([ownTokenKey(user)]);
  else if (ntfyToken) await saveSecret(ownTokenKey(user), ntfyToken);
  for (const c of CHANNELS) {
    const v = values[c];
    if (!v) continue;
    const to = v.to.trim();
    if (!to) await adminExec(`DELETE FROM hlstats_Options WHERE keyname = ?`, [ownKey(user, c)]);
    else await adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [ownKey(user, c), ownValue({ to, events: v.events })]);
  }
  if (a.via) console.info(`gameWE: own notifications changed (${Object.keys(values).join(", ")}${ntfyToken !== undefined ? ", ntfy token" : ""}) by ${who(a)}`);
}

// Queues a test message: to the admin's own address (own) or to the shared
// recipients (needs settings.edit). A test already waiting is returned.
export async function queueNotifyTest(a: Actor, channel: Channel, own: boolean): Promise<{ id: number; existing: boolean }> {
  if (!own && !allowed(a.user, "settings.edit")) throw new OpError("forbidden");
  if (!(await jobsAvailable())) throw new OpError("nojobs");
  const game = own ? userHash(a.user.username) : "";
  const [open] = await adminQuery<{ id: number }>(`SELECT id FROM hlstats_gamewe_jobs WHERE job_type = 'notify-test' AND game = ? AND mode = ? AND status IN ('pending', 'running') ORDER BY id LIMIT 1`, [game, channel]);
  if (open) return { id: Number(open.id), existing: true };
  const origin: Record<string, string> = (await jobOriginColumns()) ? { origin: a.via ? "api" : "admin", origin_detail: webOriginDetail(a.via) } : {};
  const id = await adminInsert(
    "hlstats_gamewe_jobs",
    { job_type: "notify-test", game, mode: channel, status: "pending", requested_by: a.user.username.slice(0, 64), requested_at: Math.floor(Date.now() / 1000), ...origin },
    "id",
  );
  if (a.via) console.info(`gameWE: notification test ${channel}${own ? " (own)" : ""} queued by ${who(a)}`);
  return { id, existing: false };
}

// The own ntfy token of a form (notify_ntfy_token, SecretControl): undefined
// keeps the stored one, "" (Remove ticked) deletes it.
export function ownTokenFromForm(form: Pick<FormData, "get">): string | undefined {
  if (form.get("notify_ntfy_token__clear") === "1") return "";
  return String(form.get("notify_ntfy_token") ?? "").trim() || undefined;
}

// The own values of a form: per channel the address (notify_<c>) and the
// checked events (notify_<c>_<event>).
export function ownFromForm(form: Pick<FormData, "get">): Record<Channel, Own> {
  return Object.fromEntries(
    CHANNELS.map((c) => [c, { to: String(form.get(`notify_${c}`) ?? "").trim(), events: EVENTS.filter((e) => form.get(`notify_${c}_${e}`) === "1") as NotifyEvent[] }]),
  ) as Record<Channel, Own>;
}
