import "server-only";
import { randomBytes } from "node:crypto";
import { jobOriginColumns } from "./admin-jobs";
import { OpError, who, type Actor } from "./admin-ops";
import { adminExec, adminInsert, adminQuery } from "./db";
import { webOriginDetail } from "./job-origin";
import { badWebhook, headersValue, isEvent, keepHeaderValues, parseHeaders, parseWebhookStatus, webhookIdOk, WEBHOOK_METHODS, type Webhook, type WebhookHeader, type WebhookMethod } from "./notify-core";
import { jobsAvailable } from "./reset";
import type { TestJob } from "./admin-notify";

// The webhooks of Settings → Notifications (lib/notify-core.ts has the
// checks), their tests as collector jobs (webhook-test, game: the id).
// Header values are never sent back to the browser: a page gets the names
// and whether a value is stored.

export type WebhookView = Omit<Webhook, "headers"> & {
  headers: { name: string; set: boolean }[];
  status: ReturnType<typeof parseWebhookStatus>;
  test: TestJob | null;
};

type Row = { id: string; name: string; event: string; enabled: number; method: string; url: string; headers: string; payload: string; expect_status: number; allow_private: number; last_status: string };

const COLS = "id, name, event, enabled, method, url, headers, payload, expect_status, allow_private, last_status";

// Whether the database has the table (collector 1.18 or newer, schema 32).
export async function webhooksAvailable(): Promise<boolean> {
  try {
    await adminQuery(`SELECT id FROM hlstats_gamewe_webhooks WHERE 1 = 0`);
    return true;
  } catch {
    return false;
  }
}

function view(r: Row, tests: Map<string, TestJob>): WebhookView {
  return {
    id: r.id,
    name: r.name,
    event: isEvent(r.event) ? r.event : "reset",
    enabled: Number(r.enabled) === 1,
    method: ((WEBHOOK_METHODS as readonly string[]).includes(r.method) ? r.method : "POST") as WebhookMethod,
    url: r.url,
    headers: parseHeaders(r.headers).map((h) => ({ name: h.name, set: h.value !== "" })),
    payload: r.payload,
    expect: Number(r.expect_status) || 0,
    allowPrivate: Number(r.allow_private) === 1,
    status: parseWebhookStatus(r.last_status),
    test: tests.get(r.id) ?? null,
  };
}

async function lastTests(): Promise<Map<string, TestJob>> {
  const out = new Map<string, TestJob>();
  try {
    const rows = await adminQuery<{ id: number; game: string; status: string; result: string | null; requested_at: number }>(
      `SELECT id, game, status, result, requested_at FROM hlstats_gamewe_jobs WHERE job_type = 'webhook-test' ORDER BY id DESC LIMIT 50`,
    );
    for (const r of rows) if (!out.has(r.game)) out.set(r.game, { id: Number(r.id), status: r.status, result: r.result ?? "", at: Number(r.requested_at) });
  } catch {
    // no job table: no tests
  }
  return out;
}

// All webhooks, by event and name; [] without the table.
export async function listWebhooks(): Promise<WebhookView[]> {
  if (!(await webhooksAvailable())) return [];
  const [rows, tests] = await Promise.all([adminQuery<Row>(`SELECT ${COLS} FROM hlstats_gamewe_webhooks ORDER BY event, name, id`), lastTests()]);
  return rows.map((r) => view(r, tests));
}

export async function getWebhook(id: string): Promise<WebhookView | null> {
  if (!webhookIdOk(id)) return null;
  const [rows, tests] = await Promise.all([adminQuery<Row>(`SELECT ${COLS} FROM hlstats_gamewe_webhooks WHERE id = ?`, [id]), lastTests()]);
  return rows[0] ? view(rows[0], tests) : null;
}

// Stores a webhook (id "new": a new one) and returns its id. A header
// whose value is left empty keeps the stored value of the same name. A bad
// field throws OpError("field", { field }) before anything is written.
export async function saveWebhook(a: Actor, id: string, w: Omit<Webhook, "id">): Promise<string> {
  const isNew = id === "new";
  if (!isNew && !webhookIdOk(id)) throw new OpError("notfound");
  let stored: WebhookHeader[] = [];
  if (!isNew) {
    const [row] = await adminQuery<{ headers: string }>(`SELECT headers FROM hlstats_gamewe_webhooks WHERE id = ?`, [id]);
    if (!row) throw new OpError("notfound");
    stored = parseHeaders(row.headers);
  }
  const headers = keepHeaderValues(w.headers, stored);
  const bad = badWebhook({ ...w, headers });
  if (bad) throw new OpError("field", { field: bad });
  const values = {
    name: w.name.trim(),
    event: w.event,
    enabled: w.enabled ? 1 : 0,
    method: w.method,
    url: w.url,
    headers: headersValue(headers),
    payload: w.payload,
    expect_status: w.expect,
    allow_private: w.allowPrivate ? 1 : 0,
  };
  if (isNew) {
    id = randomBytes(8).toString("hex");
    const cols = ["id", ...Object.keys(values)];
    await adminExec(`INSERT INTO hlstats_gamewe_webhooks (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, [id, ...Object.values(values)]);
  } else {
    await adminExec(`UPDATE hlstats_gamewe_webhooks SET ${Object.keys(values).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`, [...Object.values(values), id]);
  }
  console.info(`gameWE: webhook ${id} (${w.event}) ${isNew ? "added" : "changed"} by ${who(a)}`);
  return id;
}

export async function deleteWebhook(a: Actor, id: string): Promise<void> {
  if (!webhookIdOk(id)) throw new OpError("notfound");
  const { affectedRows } = await adminExec(`DELETE FROM hlstats_gamewe_webhooks WHERE id = ?`, [id]);
  if (!affectedRows) throw new OpError("notfound");
  console.info(`gameWE: webhook ${id} deleted by ${who(a)}`);
}

// Queues a test call of a webhook; a test already waiting is returned.
export async function queueWebhookTest(a: Actor, id: string): Promise<{ id: number; existing: boolean }> {
  if (!webhookIdOk(id)) throw new OpError("notfound");
  if (!(await jobsAvailable())) throw new OpError("nojobs");
  const [open] = await adminQuery<{ id: number }>(`SELECT id FROM hlstats_gamewe_jobs WHERE job_type = 'webhook-test' AND game = ? AND status IN ('pending', 'running') ORDER BY id LIMIT 1`, [id]);
  if (open) return { id: Number(open.id), existing: true };
  const origin: Record<string, string> = (await jobOriginColumns()) ? { origin: a.via ? "api" : "admin", origin_detail: webOriginDetail(a.via) } : {};
  const job = await adminInsert(
    "hlstats_gamewe_jobs",
    { job_type: "webhook-test", game: id, mode: "webhook", status: "pending", requested_by: a.user.username.slice(0, 64), requested_at: Math.floor(Date.now() / 1000), ...origin },
    "id",
  );
  return { id: job, existing: false };
}

// The webhook of a form: name, event, enabled, method, url, expect,
// payload, allow_private and the header rows (header_name and
// header_value, in order; an empty value keeps the stored one).
export function webhookFromForm(form: Pick<FormData, "get" | "getAll">): Omit<Webhook, "id"> {
  const field = (k: string) => String(form.get(k) ?? "");
  const names = form.getAll("header_name").map(String);
  const vals = form.getAll("header_value").map(String);
  const expect = field("expect").trim();
  return {
    name: field("name").trim(),
    event: field("event") as Webhook["event"],
    enabled: form.get("enabled") === "1",
    method: field("method") as WebhookMethod,
    url: field("url").trim(),
    headers: names.map((name, i) => ({ name: name.trim(), value: vals[i] ?? "" })),
    payload: field("payload").replace(/\r\n/g, "\n"),
    expect: expect === "" ? 0 : /^\d{1,3}$/.test(expect) ? Number(expect) : -1,
    allowPrivate: form.get("allow_private") === "1",
  };
}
