import "server-only";
import { secretOptions } from "./secret-options";
import { getEntity, type Entity } from "./admin-entities";
import { getRow, listRows, listSortColumn, rawOptions, withColumns, type Row } from "./admin-data";
import {
  BodyError,
  boolField,
  entityInput,
  entityRow,
  enumField,
  intField,
  isObject,
  onlyKeys,
  rawInput,
  scheduleInput,
  scheduleOut,
  settingOut,
  settingsInput,
  strField,
  type Entries,
} from "./admin-api-input";
import { globalHall, hallEntries, hallSettings } from "./admin-hall";
import { getAdminJob, jobsOverview, type Job } from "./admin-jobs";
import {
  OpError,
  assignServersTo,
  deleteEntity,
  moveServer,
  deletePlayer,
  resetRanking,
  saveEntity,
  savePrivacy,
  saveSettings,
  setGlobalHall,
  setHallEntry,
  setRankingBots,
  setRankingFastdl,
  setRankingFastdlAccess,
  setRankingHall,
  setRankingVac,
  setUserPerms,
  listRoles,
  getRole,
  saveRole,
  deleteRole,
  type Actor,
} from "./admin-ops";
import { rankingBlockVac, rankingBots, rankingFastdl, rankingFastdlAccess } from "./admin-ranking-bots";
import { ACCESS_SECRETS, FASTDL_ACCESS, type Access, type AccessField } from "./fastdl-access";
import { allServers, rankingSummaries } from "./admin-rankings";
import { RAW_GROUP, READONLY_OPTIONS, settingGroups } from "./admin-settings";
import { overLimit } from "./api";
import { MCP_DISABLED, apiDisabledResponse } from "./api-switch";
import { apiEnabled, mcpEnabled } from "./settings";
import { bearerToken, sameOwner, scopeFor } from "./api-token-core";
import { CONFIRM_SECONDS, MCP_VERSIONS, RpcError, confirmCode, confirmOk, initializeResult, originOk, rpcError, rpcMessage, rpcResult, toolCall, tools } from "./admin-mcp";
import { authenticate } from "./api-tokens";
import { adminSecret } from "./auth";
import { allowed, effectivePerms, isFullAdmin, isPerm, isRoleId, normalizePerms, parsePerms, permsKey, roleOf, type Perm, type PermUser } from "./admin-perms";
import { clientIp } from "./client-ip";
import { countChat, getChat } from "./data";
import { adminQuery } from "./db";
import { NOTIFY_LANGS, notifyState, queueNotifyTest, saveOwnNotify, type OwnTokens } from "./admin-notify";
import { CHANNELS, EVENTS, isEvent, type Channel, type Own } from "./notify-core";
import { scheduleValue } from "./hall-period";
import { countIps, searchIps } from "./history";
import { ADMIN_ENTITIES, ADMIN_PAGE_MAX, adminOps, matchOp, type AdminOp } from "./openapi-admin";
import { ALL_OPERATOR_KEYS, readOperator } from "./privacy-operator";
import { RESET_MODES, resetMode } from "./reset-modes";
import { ipSorts, type IpSort } from "./table-sort";

// The admin API (/api/v1/admin/..., app/api/v1/admin/[...path]/route.ts):
// the operations of lib/openapi-admin.ts, authenticated with an admin's API
// token (lib/api-tokens.ts) and carried out by the same functions as the
// admin pages (lib/admin-ops.ts). Only "Authorization: Bearer"; cookies are
// never read, so there is no CSRF surface, and answers are never cached.

const RATE = 300; // requests per address and minute
const FAIL_MAX = 20; // failed authentications per address ...
const FAIL_MINUTES = 15; // ... and window; then blocked for the window
const BODY_MAX = 64 * 1024;

const failures = new Map<string, { n: number; until: number }>();

function failedBefore(ip: string): number {
  const f = failures.get(ip);
  return f && f.until > Date.now() && f.n >= FAIL_MAX ? Math.ceil((f.until - Date.now()) / 1000) : 0;
}

function fail(ip: string) {
  const f = failures.get(ip);
  if (failures.size > 10000) failures.clear();
  failures.set(ip, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + FAIL_MINUTES * 60_000 });
}

class ApiFail extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function json(status: number, data: unknown, extra: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      ...(status === 204 ? {} : { "content-type": "application/json; charset=utf-8" }),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });
}

const error = (status: number, code: string, message: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  json(status, { error: code, message, ...extra }, headers);

// ---------------------------------------------------------------- routing

type Ctx = { actor: Actor; token: { id: string; name: string; scopes: string[]; prefix: string }; op: AdminOp; params: Record<string, string>; query: URLSearchParams; body: unknown };
type Result = { status?: number; body?: unknown };
type Handler = (c: Ctx) => Promise<Result>;

export async function adminApi(req: Request, segments: string[]): Promise<Response> {
  // API off: no token is even looked at.
  if (!(await apiEnabled())) return apiDisabledResponse();
  const isMcp = segments.length === 1 && segments[0] === "mcp";
  // MCP off: the same, for this one path only.
  if (isMcp && !(await mcpEnabled())) return apiDisabledResponse(MCP_DISABLED);
  const method = req.method.toUpperCase();
  const ip = await clientIp();
  const wait = failedBefore(ip);
  if (wait) return error(429, "rate_limited", "too many failed authentications", {}, { "retry-after": String(wait) });
  const token = bearerToken(req.headers.get("authorization"));
  const auth = token ? await authenticate(token) : null;
  if (!auth) {
    fail(ip);
    return error(401, "unauthorized", "a valid API token is required (Authorization: Bearer gwe_...)", {}, { "www-authenticate": 'Bearer realm="gameWE admin API"' });
  }
  const busy = await overLimit("admin-api", RATE);
  if (busy) return error(429, "rate_limited", `more than ${RATE} requests per minute`, {}, { "retry-after": String(busy) });

  const actor: Actor = { user: auth.user, via: auth.token.name };
  if (isMcp) return mcp(req, method, actor, auth.token);
  const path = `/admin/${segments.map(encodeURIComponent).join("/")}`;
  let status = 500;
  try {
    const m = matchOp(segments, method);
    if (!m) throw new ApiFail(404, "not_found", "unknown admin API path");
    if ("allow" in m) {
      return error(405, "method_not_allowed", `use ${m.allow.join(", ")}`, {}, { allow: m.allow.join(", ") });
    }
    const need = scopeFor(method);
    if (!auth.token.scopes.includes(need)) throw new ApiFail(403, "insufficient_scope", `this token lacks the scope ${need}`);
    if (!allowed(auth.user, m.op.need)) throw new ApiFail(403, "forbidden", m.op.need === "admin" ? "needs admin level 100" : `needs the right ${m.op.need}`);
    const body = m.op.body ? await readBody(req) : undefined;
    const query = new URL(req.url).searchParams;
    const allowedQuery = (m.op.params ?? []).filter((p) => p.in === "query").map((p) => p.name);
    for (const k of query.keys()) if (!allowedQuery.includes(k)) throw new ApiFail(400, "unknown_parameter", `unknown query parameter ${k}`, { field: k });
    const res = await handlers[m.op.handler]({ actor, token: auth.token, op: m.op, params: m.params, query, body });
    status = res.status ?? m.op.status;
    return json(status, res.body ?? null);
  } catch (err) {
    const r = failure(err);
    status = r.status;
    return r;
  } finally {
    if (method !== "GET") console.info(`gameWE: admin API ${method} ${path} -> ${status} by ${auth.user.username} via token "${auth.token.name}" (${auth.token.prefix})`);
  }
}

// The MCP server (lib/admin-mcp.ts): POST only, one JSON-RPC message, the
// answer as JSON. Authentication, rate limit and failures are the API's.
async function mcp(req: Request, method: string, actor: Actor, token: Ctx["token"]): Promise<Response> {
  if (!token.scopes.includes("mcp")) return error(403, "insufficient_scope", "this token lacks the scope mcp");
  if (!originOk(req.headers.get("origin"), [req.headers.get("host"), req.headers.get("x-forwarded-host")])) return error(403, "forbidden_origin", "requests from other sites are refused");
  if (method !== "POST") return error(405, "method_not_allowed", "use POST (stateless, no event stream)", {}, { allow: "POST" });
  const version = req.headers.get("mcp-protocol-version");
  if (version !== null && !MCP_VERSIONS.includes(version)) return error(400, "unsupported_protocol_version", `supported: ${MCP_VERSIONS.join(", ")}`);
  let id: string | number | null = null;
  try {
    const msg = rpcMessage(await readBody(req).catch((err) => {
      if (err instanceof ApiFail && err.code === "invalid_json") throw new RpcError(-32700, "parse error");
      throw err;
    }));
    // A notification (e.g. notifications/initialized) gets no answer.
    if (msg.id === undefined) return new Response(null, { status: 202, headers: { "cache-control": "no-store" } });
    id = msg.id;
    const p = msg.params ?? {};
    switch (msg.method) {
      case "initialize":
        return json(200, rpcResult(id, initializeResult(p.protocolVersion, process.env.APP_VERSION || "0")));
      case "ping":
        return json(200, rpcResult(id, {}));
      case "tools/list":
        return json(200, rpcResult(id, { tools: tools(actor.user, token.scopes) }));
      case "tools/call": {
        const call = toolCall(p.name, p.arguments, actor.user, token.scopes);
        const out = (isError: boolean, body: unknown) => json(200, rpcResult(id, { content: [{ type: "text", text: JSON.stringify(body) }], isError }));
        const what = `${call.op.method} /api/v1${call.op.path.replace(/\{(\w+)\}/g, (_, k: string) => call.params[k])}${call.query.size ? `?${call.query}` : ""}`;
        const writing = call.op.method !== "GET";
        if (writing) {
          // Never on the first call: what would happen, and a code for the second.
          const secret = adminSecret();
          if (!secret) throw new ApiFail(503, "not_available", "ADMIN_SECRET is not set");
          const now = Math.floor(Date.now() / 1000);
          if (call.confirmation === undefined) {
            return out(false, {
              confirmationRequired: true,
              tool: call.op.operationId,
              operation: what,
              summary: call.op.summary,
              arguments: call.args,
              confirmation: confirmCode(secret, token.id, call.op.operationId, call.args, now),
              expiresInSeconds: CONFIRM_SECONDS,
              next: "Nothing has changed yet. Show the user this operation and its arguments and ask whether to do it. Only if they agree, call the same tool again with the same arguments and this confirmation.",
            });
          }
          if (!confirmOk(call.confirmation, secret, token.id, call.op.operationId, call.args, now)) {
            return out(true, { error: "confirmation_invalid", message: "the confirmation is wrong, expired or for other arguments: call the tool without confirmation to get a new one, and ask the user again" });
          }
        }
        let status = 500;
        try {
          const r = await handlers[call.op.handler]({ actor, token, op: call.op, params: call.params, query: call.query, body: call.body });
          status = r.status ?? call.op.status;
          return out(false, r.body ?? null);
        } catch (err) {
          // The REST error ({ error, message, field? }) for the model to read.
          const f = failure(err);
          status = f.status;
          return out(true, await f.json());
        } finally {
          if (writing) console.info(`gameWE: admin MCP ${what} -> ${status} by ${actor.user.username} via token "${token.name}" (${token.prefix})`);
        }
      }
      default:
        throw new RpcError(-32601, `unknown method ${msg.method}`);
    }
  } catch (err) {
    if (err instanceof RpcError) return json(200, rpcError(id, err.code, err.message));
    return failure(err);
  }
}

async function readBody(req: Request): Promise<unknown> {
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new ApiFail(415, "unsupported_media_type", "send the body as Content-Type: application/json");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > BODY_MAX) throw new ApiFail(413, "body_too_large", `at most ${BODY_MAX} bytes`);
  const text = await req.text();
  if (Buffer.byteLength(text) > BODY_MAX) throw new ApiFail(413, "body_too_large", `at most ${BODY_MAX} bytes`);
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiFail(400, "invalid_json", "the body is no valid JSON");
  }
}

function failure(err: unknown): Response {
  if (err instanceof ApiFail) return error(err.status, err.code, err.message, err.extra);
  if (err instanceof BodyError) return error(err.status, err.code, err.message, err.field ? { field: err.field } : {});
  if (err instanceof OpError) {
    const d = err.detail;
    switch (err.code) {
      case "notfound":
        return error(404, "not_found", "not found");
      case "cannot":
        return error(405, "method_not_allowed", "not possible for this kind of row");
      case "self":
        return error(403, "self_security_forbidden", "not for your own account");
      case "lastadmin":
        return error(409, "last_full_admin", "at least one admin with level 100 must stay");
      case "perm":
        return error(403, "forbidden", "you cannot hand out a right you do not have yourself", { field: "permissions" });
      case "password":
        return error(403, "password_own_only", "an admin's password is set only when the admin is created", { field: "password" });
      case "mismatch":
        return error(409, "mismatch", "server and ranking are of different games");
      case "duplicate":
        if (d.name) return error(409, "duplicate", "another admin role has this name", { field: "name" });
        return error(409, "duplicate", "another server has this IP address and port", d.dup ? { id: Number(d.dup) } : {});
      case "inuse":
        return error(409, "role_in_use", "admins still have this role: give them another role or rights of their own first");
      case "limit":
        return error(409, "limit", "at most 50 admin roles");
      case "forbidden":
        return error(403, "forbidden", "you lack the right for this");
      case "field":
        return error(400, "invalid_field", `invalid value of ${d.field}`, { field: d.field });
      case "input":
        return error(400, "invalid_input", "invalid input");
      case "confirm":
        return error(400, "confirmation_required", "this change needs confirm: true");
      case "table":
        return error(503, "not_available", "the database lacks the table for this (update the collector)");
      case "nojobs":
        return error(503, "jobs_unavailable", "the database has no job table (collector 0.1.0 or newer)");
      case "template":
        return error(409, "template_ranking", "the ranking is a template (no servers) and is never reset");
      case "db":
        // A row with the same unique key (e.g. an award code twice in a ranking).
        if (d.dupkey) return error(409, "duplicate", "a row with the same key exists already");
        // A new ranking is saved, but copying its template's definitions failed.
        if (d.saved) return error(500, "database_error", `the ranking was created, but copying the template's definitions failed: ${d.msg}`, { created: true });
        return error(500, "database_error", d.msg ? `the database refused the change: ${d.msg}` : "the database refused the change");
    }
  }
  console.error("admin api:", err instanceof Error ? err.message : err);
  return error(500, "internal_error", "internal error");
}

// ---------------------------------------------------------------- helpers

const form = (entries: Entries) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

function intQuery(q: URLSearchParams, name: string, def: number, min: number, max: number): number {
  const v = q.get(name);
  if (v === null) return def;
  if (!/^\d{1,9}$/.test(v) || Number(v) < min || Number(v) > max) throw new ApiFail(400, "invalid_parameter", `${name} must be an integer from ${min} to ${max}`, { field: name });
  return Number(v);
}

function strQuery(q: URLSearchParams, name: string, ok: (s: string) => boolean, what: string): string | undefined {
  const v = q.get(name);
  if (v === null || v === "") return undefined;
  if (!ok(v)) throw new ApiFail(400, "invalid_parameter", `${name} must be ${what}`, { field: name });
  return v;
}

const codeOk = (s: string) => /^[A-Za-z0-9_-]{1,32}$/.test(s);
const asc = (q: URLSearchParams, def: boolean) => {
  const o = strQuery(q, "order", (s) => s === "asc" || s === "desc", "asc or desc");
  return o === undefined ? def : o === "asc";
};
const pageOf = <T>(data: T[], page: number, limit: number, total: number) => ({ data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });

async function ranking(code: string) {
  const r = (await rankingSummaries()).find((x) => x.code === code);
  if (!r) throw new ApiFail(404, "not_found", "unknown ranking");
  return r;
}

// The entity of an operation, with the columns this database has.
async function entityOf(c: Ctx): Promise<{ e: Entity; m: (typeof ADMIN_ENTITIES)[number] }> {
  const m = ADMIN_ENTITIES.find((x) => x.key === c.op.entity)!;
  return { e: await withColumns(getEntity(m.key)!), m };
}

// The primary key of the row in the path (a ranking is addressed by code).
async function rowKey(c: Ctx, m: (typeof ADMIN_ENTITIES)[number]): Promise<string> {
  if (m.id === "code") {
    const [r] = await adminQuery<{ id: number }>(`SELECT id FROM hlstats_Games WHERE TRIM(code) = ?`, [c.params.code]);
    if (!r) throw new ApiFail(404, "not_found", "unknown ranking");
    return String(r.id);
  }
  return m.id === "username" ? c.params.username : c.params.id;
}

async function rowOut(e: Entity, id: string): Promise<Record<string, unknown>> {
  const row = await getRow(e, id);
  if (!row) throw new ApiFail(404, "not_found", "not found");
  const out = entityRow(e, row as Record<string, unknown>);
  return e.key === "users" ? (await withUserPerms([out]))[0] : out;
}

// The rights of admins as the API returns them (level 100: every right).
async function withUserPerms(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  const keys = rows.map((r) => permsKey(String(r.username ?? r.id)));
  const stored = keys.length ? await adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [keys]) : [];
  const byKey = new Map(stored.map((r) => [r.keyname, r.value ?? ""]));
  const roles = stored.some((r) => roleOf(r.value) !== null) ? await listRoles() : [];
  return rows.map((r, i) => {
    const full = Number(r.acclevel) >= 100;
    const raw = byKey.get(keys[i]) ?? null;
    const role = full ? null : roles.find((x) => x.id === roleOf(raw));
    return { ...r, role: role ? role.id : null, permissions: effectivePerms({ acclevel: Number(r.acclevel), perms: role ? role.perms : parsePerms(raw) }) };
  });
}

// permissions and role of a users body: taken out before the fields are checked.
function permsInput(body: unknown): { body: unknown; perms?: Perm[]; role?: string | null } {
  if (!isObject(body) || !("permissions" in body || "role" in body)) return { body };
  const { permissions: v, role, ...rest } = body;
  if (v !== undefined && (!Array.isArray(v) || v.length > 64 || v.some((p) => !isPerm(p)))) throw new BodyError(400, "invalid_field", "permissions", "permissions must be an array of known rights (see AdminUser)");
  if (role !== undefined && role !== null && !isRoleId(role)) throw new BodyError(400, "invalid_field", "role", "role must be the id of an admin role (GET /admin/admin-roles) or null");
  if (role && v !== undefined) throw new BodyError(400, "invalid_field", "permissions", "give either role or permissions: an admin with a role has the role's rights");
  return { body: rest, perms: v === undefined ? undefined : normalizePerms(v as string[]), role: role as string | null | undefined };
}

const roleOut = (r: Awaited<ReturnType<typeof listRoles>>[number]) => ({ id: r.id, name: r.name, permissions: r.perms, admins: r.admins });

async function roleOr404(id: string) {
  const r = await getRole(id);
  if (!r) throw new ApiFail(404, "not_found", "no admin role with this id");
  return r;
}

function rolePerms(v: unknown): Perm[] {
  if (!Array.isArray(v) || v.length > 64 || v.some((p) => !isPerm(p))) throw new BodyError(400, "invalid_field", "permissions", "permissions must be an array of known rights");
  return normalizePerms(v as string[]);
}

// The token's own account: what the database takes for the same user name
// (its collation may ignore case, accents or trailing spaces) or the same
// name loosely. Nothing that touches it is allowed with a token.
async function isSelf(c: Ctx, name: string): Promise<boolean> {
  const owner = c.actor.user.username;
  if (sameOwner(name, owner)) return true;
  const [r] = await adminQuery<{ n: number | string }>(`SELECT COUNT(*) AS n FROM hlstats_Users WHERE username = ? AND username = ?`, [name, owner]);
  return Number(r?.n ?? 0) > 0;
}

async function guardSelf(c: Ctx, name: string) {
  if (await isSelf(c, name)) {
    throw new ApiFail(403, "self_security_forbidden", "your own account (password, TOTP, level, deletion) cannot be changed with an API token; use your account page");
  }
}

const scheduleEntries = (b: Record<string, unknown>, required: boolean): Entries => {
  if (b.schedule === undefined) {
    if (required) throw new BodyError(400, "missing_field", "schedule", "schedule is required");
    return [];
  }
  return scheduleInput(b.schedule);
};

function apiJob(j: Job, c: Ctx) {
  // Who queued a job: other admins' names (and their token names) only for
  // level 100 (as the Jobs page).
  const show = isFullAdmin(c.actor.user) || j.requestedBy === c.actor.user.username;
  const o = j.origin;
  return {
    ...j,
    requestedBy: show ? j.requestedBy : "",
    origin: { ...o, schedule: scheduleValue(o.schedule), token: show ? o.token : "" },
  };
}

async function hallOut(code: string) {
  const h = await hallSettings(code);
  return {
    source: h.source,
    schedule: scheduleOut(h.schedule),
    mode: h.mode,
    page: h.page,
    global: { schedule: scheduleOut(h.global.schedule), mode: h.global.mode },
    effective: scheduleOut(h.effective),
    effectiveMode: h.effectiveMode,
    lastStart: h.last,
    periods: h.entries,
    available: h.table,
  };
}

async function settingsOut(groupId: string, user: PermUser) {
  const g = settingGroups.find((x) => x.id === groupId);
  if (!g) throw new ApiFail(404, "not_found", "unknown settings page");
  const rows = await adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [g.items.map((s) => s.key)]);
  const stored = new Map<string, string>([...rows.map((r): [string, string] => [r.keyname, r.value ?? ""]), ...Object.entries(await secretOptions())]);
  return {
    id: g.id,
    area: g.area,
    title: g.title.en,
    settings: Object.fromEntries(g.items.map((s) => [s.key, settingOut(s, s.type === "secret" ? (stored.get(s.key) ? "1" : undefined) : stored.get(s.key))])),
    readOnly: g.items.filter((s) => s.minLevel !== undefined && !allowed(user, "settings.protected")).map((s) => s.key),
  };
}

async function ownNotifyOut(user: string) {
  const s = await notifyState(user);
  // ready: the channel can send (e-mail: the site's SMTP server; Telegram: the own bot token).
  return { channels: s.own.map((o) => ({ channel: o.channel, ready: o.ready, to: o.to, events: o.events, ...(o.channel === "email" ? {} : { token: o.token }), status: o.status, test: o.test })), lang: s.lang, collectorRunning: s.collector, available: s.jobs };
}

// ---------------------------------------------------------------- handlers

const handlers: Record<string, Handler> = {
  async me(c) {
    return { body: { username: c.actor.user.username, level: c.actor.user.acclevel, permissions: effectivePerms(c.actor.user), token: { name: c.token.name, scopes: c.token.scopes, prefix: c.token.prefix } } };
  },

  // Rows of the admin entities (rankings, servers, players, clans, ...).
  async entityList(c) {
    const { e } = await entityOf(c);
    const q = c.query;
    const game = e.gameColumn ? strQuery(q, "game", codeOk, "a ranking code") : undefined;
    const search = strQuery(q, "q", (s) => s.length <= 100, "at most 100 characters");
    const status = strQuery(q, "status", (s) => !!e.statusFilter?.some((f) => f.value === s), `one of ${(e.statusFilter ?? []).map((f) => f.value).join(", ")}`);
    const sort = strQuery(q, "sort", (s) => listSortColumn(e, s) !== null, "a list field");
    const page = intQuery(q, "page", 1, 1, 100000);
    const limit = intQuery(q, "limit", 50, 1, ADMIN_PAGE_MAX);
    const r = await listRows(e, { game, q: search, status, page, pageSize: limit, sort, asc: asc(q, false) });
    const rows = r.rows.map((row: Row) => entityRow(e, row as Record<string, unknown>));
    return { body: pageOf(e.key === "users" ? await withUserPerms(rows) : rows, page, limit, r.total) };
  },
  async entityGet(c) {
    const { e, m } = await entityOf(c);
    return { body: await rowOut(e, await rowKey(c, m)) };
  },
  async entityCreate(c) {
    const { e } = await entityOf(c);
    const p = e.key === "users" ? permsInput(c.body) : { body: c.body };
    const input = entityInput(e, p.body, true);
    if (e.key === "users") {
      const name = input.entries.find(([k]) => k === "username")?.[1];
      if (name !== undefined) await guardSelf(c, name);
    }
    const saved = await saveEntity(c.actor, e, null, form(input.entries), { perms: p.perms, role: p.role });
    return { body: await rowOut(e, saved) };
  },
  async entityUpdate(c) {
    const { e, m } = await entityOf(c);
    const id = await rowKey(c, m);
    if (e.key === "users") {
      await guardSelf(c, id);
      // Each admin changes only their own password (My account), never another's.
      if (isObject(c.body) && "password" in c.body) {
        throw new ApiFail(403, "password_own_only", "an admin's password is set only when the admin is created; afterwards only its owner changes it, on their account page", { field: "password" });
      }
    }
    const p = e.key === "users" ? permsInput(c.body) : { body: c.body };
    // Only the rights: no row to write.
    if ((p.perms || p.role !== undefined) && isObject(p.body) && !Object.keys(p.body).length) await setUserPerms(c.actor, id, p.perms, p.role);
    else {
      const input = entityInput(e, p.body, false);
      await saveEntity(c.actor, e, id, form(input.entries), { only: input.only, perms: p.perms, role: p.role });
    }
    return { body: await rowOut(e, id) };
  },
  async entityDelete(c) {
    const { e, m } = await entityOf(c);
    const id = await rowKey(c, m);
    if (e.key === "users") await guardSelf(c, id);
    await deleteEntity(c.actor, e, id);
    return {};
  },

  // Admin roles (level 100 only, as the admins they are given to).
  async rolesList() {
    return { body: (await listRoles()).map(roleOut) };
  },
  async roleGet(c) {
    return { body: roleOut(await roleOr404(c.params.role)) };
  },
  async roleCreate(c) {
    const b = onlyKeys(c.body, ["name", "permissions"], ["name", "permissions"]);
    return { body: roleOut(await roleOr404(await saveRole(c.actor, null, b.name, rolePerms(b.permissions)))) };
  },
  async roleUpdate(c) {
    const b = onlyKeys(c.body, ["name", "permissions"]);
    if (!Object.keys(b).length) throw new ApiFail(400, "invalid_input", "give name or permissions");
    const cur = await roleOr404(c.params.role);
    await saveRole(c.actor, cur.id, b.name ?? cur.name, b.permissions === undefined ? cur.perms : rolePerms(b.permissions));
    return { body: roleOut(await roleOr404(cur.id)) };
  },
  async roleDelete(c) {
    await deleteRole(c.actor, (await roleOr404(c.params.role)).id);
    return {};
  },

  // Rankings.
  async rankingsList() {
    return { body: (await rankingSummaries()).map((r) => ({ id: r.id, code: r.code, name: r.name, hidden: r.hidden, baseGame: r.base, servers: r.servers, template: r.template })) };
  },
  async rankingServers(c) {
    await ranking(c.params.code);
    return { body: (await allServers()).filter((s) => s.game === c.params.code).map((s) => ({ id: Number(s.serverId), name: s.name, address: s.address, port: Number(s.port) })) };
  },
  async rankingAssign(c) {
    await ranking(c.params.code);
    const b = onlyKeys(c.body, ["servers"], ["servers"]);
    const ids = b.servers;
    if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some((n) => typeof n !== "number" || !Number.isInteger(n) || n < 1)) {
      throw new BodyError(400, "invalid_field", "servers", "servers must be an array of 1 to 500 server IDs");
    }
    const known = new Set((await allServers()).map((s) => Number(s.serverId)));
    const unknown = (ids as number[]).filter((n) => !known.has(n));
    if (unknown.length) throw new BodyError(400, "invalid_field", "servers", `unknown servers: ${unknown.join(", ")}`);
    const r = await assignServersTo(c.actor, c.params.code, [...new Set(ids as number[])]);
    return { body: { moved: r.moved } };
  },
  async serverMove(c) {
    const b = onlyKeys(c.body, ["ranking"], ["ranking"]);
    const target = strField(b, "ranking", 32);
    await ranking(target).catch(() => {
      throw new BodyError(400, "invalid_field", "ranking", "unknown ranking");
    });
    await moveServer(c.actor, Number(c.params.id), target);
    return { body: { ok: true } };
  },
  async botsGet(c) {
    await ranking(c.params.code);
    return { body: await rankingBots(c.params.code) };
  },
  async botsSet(c) {
    await ranking(c.params.code);
    const b = onlyKeys(c.body, ["ranked", "points", "kills", "stats"], ["ranked", "points", "kills", "stats"]);
    const next = { ranked: boolField(b, "ranked"), points: boolField(b, "points"), kills: boolField(b, "kills"), stats: boolField(b, "stats") };
    const n = await setRankingBots(c.actor, c.params.code, next);
    return { body: { ...next, changedBots: n } };
  },
  async vacGet(c) {
    await ranking(c.params.code);
    return { body: { block: await rankingBlockVac(c.params.code) } };
  },
  async vacSet(c) {
    await ranking(c.params.code);
    const b = onlyKeys(c.body, ["block"], ["block"]);
    const on = boolField(b, "block");
    await setRankingVac(c.actor, c.params.code, on);
    return { body: { block: on } };
  },
  async fastdlGet(c) {
    await ranking(c.params.code);
    const [url, access] = await Promise.all([rankingFastdl(c.params.code), rankingFastdlAccess(c.params.code)]);
    return { body: { url, ...access } };
  },
  async fastdlSet(c) {
    const code = c.params.code;
    await ranking(code);
    const b = onlyKeys(c.body, ["url", ...FASTDL_ACCESS], ["url"]);
    // A missing field keeps what is stored; null removes a secret.
    const now = await rankingFastdlAccess(code);
    const access: Access = {};
    const clear: AccessField[] = [];
    for (const f of FASTDL_ACCESS) {
      const secret = ACCESS_SECRETS.includes(f);
      if (b[f] === undefined) {
        if (!secret) access[f] = now[f as "agent" | "referer" | "user"];
      } else if (b[f] === null && secret) clear.push(f);
      else access[f] = strField(b, f, 255);
    }
    const url = await setRankingFastdl(c.actor, code, strField(b, "url", 255));
    await setRankingFastdlAccess(c.actor, code, access, clear);
    return { body: { url, ...(await rankingFastdlAccess(code)) } };
  },
  async hallGet(c) {
    await ranking(c.params.code);
    return { body: await hallOut(c.params.code) };
  },
  async hallSet(c) {
    await ranking(c.params.code);
    const b = onlyKeys(c.body, ["source", "schedule", "mode", "page", "confirm"], ["source", "mode", "page"]);
    const source = enumField(b, "source", ["global", "own", "off"] as const);
    const mode = enumField(b, "mode", RESET_MODES);
    const page = enumField(b, "page", ["auto", "on", "off"] as const);
    const confirm = b.confirm === undefined ? false : boolField(b, "confirm");
    const entries = source === "own" ? scheduleEntries(b, true) : b.schedule === undefined ? [] : scheduleEntries(b, false);
    await setRankingHall(c.actor, c.params.code, source, resetMode(mode), page, form([...entries, ["understood", confirm ? "yes" : ""]]));
    return { body: await hallOut(c.params.code) };
  },
  async hallEntries(c) {
    await ranking(c.params.code);
    const periods = await hallEntries(c.params.code);
    return {
      body: periods.map((p) => ({
        unit: p.unit,
        every: p.every,
        start: p.start,
        end: p.end,
        entries: p.entries.map((x) => ({ place: x.place, playerId: x.playerId, name: x.name, currentName: x.currentName, points: x.skill, kills: x.kills, removed: x.removed, hidden: x.hidden })),
      })),
    };
  },
  async hallRemove(c) {
    await ranking(c.params.code);
    const b = onlyKeys(c.body, ["start", "place", "confirm"], ["start", "confirm"]);
    const place = b.place === undefined ? null : intField(b, "place", 1, 99);
    const n = await setHallEntry(c.actor, c.params.code, strField(b, "start", 10), place, "remove", boolField(b, "confirm"));
    return { body: { changed: n } };
  },
  async hallRestore(c) {
    await ranking(c.params.code);
    const b = onlyKeys(c.body, ["start", "place"], ["start"]);
    const place = b.place === undefined ? null : intField(b, "place", 1, 99);
    const n = await setHallEntry(c.actor, c.params.code, strField(b, "start", 10), place, "restore", false);
    return { body: { changed: n } };
  },
  async ownNotifyGet(c) {
    return { body: await ownNotifyOut(c.actor.user.username) };
  },
  async ownNotifySet(c) {
    const b = onlyKeys(c.body, [...CHANNELS, "lang"]);
    const values: Partial<Record<Channel, Own>> = {};
    const tokens: OwnTokens = {};
    const lang = b.lang === undefined ? undefined : enumField(b, "lang", ["", ...NOTIFY_LANGS.map((l) => l.code)]);
    for (const ch of CHANNELS) {
      if (b[ch] === undefined) continue;
      const v = onlyKeys(b[ch], ch === "email" ? ["to", "events"] : ["to", "events", "token"], ["to", "events"]);
      if (!Array.isArray(v.events) || v.events.length > EVENTS.length || !v.events.every(isEvent)) throw new BodyError(400, "invalid_field", ch, `${ch}.events must be an array of ${EVENTS.join(", ")}`);
      values[ch] = { to: strField(v, "to", 200), events: v.events };
      if (v.token !== undefined && ch !== "email") tokens[ch] = strField(v, "token", 128);
    }
    await saveOwnNotify(c.actor, values, tokens, lang);
    return { body: await ownNotifyOut(c.actor.user.username) };
  },
  async ownNotifyTest(c) {
    const b = onlyKeys(c.body, ["channel"], ["channel"]);
    const job = await queueNotifyTest(c.actor, enumField(b, "channel", CHANNELS));
    return { body: { job: job.id, existing: job.existing } };
  },
  async reset(c) {
    await ranking(c.params.code);
    const b = onlyKeys(c.body, ["mode", "confirm"], ["mode", "confirm"]);
    const mode = enumField(b, "mode", RESET_MODES);
    if (!boolField(b, "confirm")) throw new ApiFail(400, "confirmation_required", "a reset deletes data for good: send confirm: true", { field: "confirm" });
    const job = await resetRanking(c.actor, c.params.code, mode);
    return { body: { job: job.id, existing: job.existing } };
  },
  async playerErase(c) {
    const b = onlyKeys(c.body, ["confirm"], ["confirm"]);
    if (!boolField(b, "confirm")) throw new ApiFail(400, "confirmation_required", "this deletes data for good: send confirm: true", { field: "confirm" });
    return { body: { job: await deletePlayer(c.actor, c.params.id) } };
  },
  async globalHallGet() {
    const g = await globalHall();
    return { body: { enabled: g.enabled, schedule: scheduleOut(g.schedule), mode: g.mode } };
  },
  async globalHallSet(c) {
    const b = onlyKeys(c.body, ["enabled", "schedule", "mode", "confirm"], ["enabled", "schedule", "mode"]);
    const enabled = boolField(b, "enabled");
    const mode = enumField(b, "mode", RESET_MODES);
    const confirm = b.confirm === undefined ? false : boolField(b, "confirm");
    await setGlobalHall(c.actor, enabled, resetMode(mode), form([...scheduleEntries(b, true), ["understood", confirm ? "yes" : ""]]));
    const g = await globalHall();
    return { body: { enabled: g.enabled, schedule: scheduleOut(g.schedule), mode: g.mode } };
  },

  // Jobs.
  async jobs(c) {
    // Templates (no servers) are never reset, also with an old plan key left.
    const codes = (await rankingSummaries()).filter((r) => r.servers > 0).map((r) => r.code);
    const ov = await jobsOverview(codes);
    return {
      body: {
        collectorSeen: ov.heartbeat,
        queue: ov.queue.map((j) => apiJob(j, c)),
        history: ov.history.map((j) => apiJob(j, c)),
        scheduled: ov.rankings.map((r) => ({ game: r.game, schedule: scheduleOut(r.schedule), mode: r.mode, next: r.next })),
        available: ov.table,
      },
    };
  },
  async job(c) {
    const j = await getAdminJob(Number(c.params.id));
    if (!j) throw new ApiFail(404, "not_found", "unknown job");
    return { body: apiJob(j, c) };
  },

  // Settings.
  async settingGroups(c) {
    return {
      body: settingGroups.map((g) => ({
        id: g.id,
        area: g.area,
        title: g.title.en,
        settings: g.items.map((s) => ({ key: s.key, type: s.type, label: s.label.en, readOnly: s.minLevel !== undefined && !allowed(c.actor.user, "settings.protected") })),
      })),
    };
  },
  async settingsGet(c) {
    return { body: await settingsOut(c.params.group, c.actor.user) };
  },
  async settingsSet(c) {
    const g = settingGroups.find((x) => x.id === c.params.group);
    if (!g) throw new ApiFail(404, "not_found", "unknown settings page");
    const input = settingsInput(g.items, c.body);
    await saveSettings(c.actor, g.id, form(input.entries), input.only);
    return { body: await settingsOut(g.id, c.actor.user) };
  },
  async rawGet() {
    return { body: (await rawOptions()).map((r) => ({ key: r.keyname, value: r.value, readOnly: READONLY_OPTIONS.includes(r.keyname) })) };
  },
  async rawSet(c) {
    const input = rawInput(c.body);
    const rows = new Set((await rawOptions()).map((r) => r.keyname));
    for (const k of input.keys) {
      if (!rows.has(k)) throw new BodyError(400, "unknown_field", k, `${k} is no raw option (see GET /admin/settings/raw; settings of a page are changed there)`);
      if (READONLY_OPTIONS.includes(k)) throw new BodyError(400, "read_only_field", k, `${k} is written by the collector`);
    }
    const r = await saveSettings(c.actor, RAW_GROUP, form(input.entries));
    return { body: r };
  },
  async privacyGet() {
    const rows = await adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [ALL_OPERATOR_KEYS]);
    return { body: readOperator(Object.fromEntries(rows.map((r) => [r.keyname, r.value ?? ""]))) };
  },
  async privacySet(c) {
    const b = onlyKeys(c.body, ["name", "address", "email", "text"], ["name", "address", "email", "text"]);
    const entries: Entries = (["name", "address", "email", "text"] as const).map((k) => [k, strField(b, k, k === "text" ? 3000 : 120)]);
    await savePrivacy(c.actor, form(entries));
    return handlers.privacyGet(c);
  },

  // Personal data the admin area shows.
  async chat(c) {
    const q = c.query;
    const page = intQuery(q, "page", 1, 1, 100000);
    const limit = intQuery(q, "limit", 50, 1, ADMIN_PAGE_MAX);
    const filter = {
      game: strQuery(q, "game", codeOk, "a ranking code"),
      playerId: intQuery(q, "player", 0, 1, 9999999999) || undefined,
      search: strQuery(q, "q", (s) => s.length <= 100, "at most 100 characters"),
    };
    const [rows, total] = await Promise.all([getChat({ ...filter, limit, offset: (page - 1) * limit, asc: asc(q, false) }), countChat(filter)]);
    return {
      body: pageOf(
        rows.map((r) => ({ time: Number(r.timestamp_id), playerId: Number(r.playerId), name: r.name, team: Number(r.message_mode) === 2, message: r.message, server: r.server })),
        page,
        limit,
        total,
      ),
    };
  },
  async ips(c) {
    const q = c.query;
    const page = intQuery(q, "page", 1, 1, 100000);
    const limit = intQuery(q, "limit", 50, 1, ADMIN_PAGE_MAX);
    const days = intQuery(q, "days", 0, 1, 3650);
    const filter = { game: strQuery(q, "game", codeOk, "a ranking code"), q: strQuery(q, "q", (s) => s.length <= 100, "at most 100 characters"), days: days || undefined };
    const sort = (strQuery(q, "sort", (s) => s in ipSorts, `one of ${Object.keys(ipSorts).join(", ")}`) ?? "last") as IpSort;
    const [rows, total] = await Promise.all([searchIps({ ...filter, limit, offset: (page - 1) * limit, sort, asc: asc(q, false) }), countIps(filter)]);
    return { body: pageOf(rows, page, limit, total) };
  },
};

// Every documented operation has its handler (checked once at start-up and
// in tests/admin-api.test.ts).
for (const op of adminOps) if (!handlers[op.handler]) throw new Error(`admin API: no handler ${op.handler} for ${op.operationId}`);

