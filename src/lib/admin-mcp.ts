import { createHmac, timingSafeEqual } from "node:crypto";
import { adminOps, matchOp, type AdminOp } from "./openapi-admin.ts";
import { allowed, type PermUser } from "./admin-perms.ts";

// The MCP server of the admin API (POST /api/v1/admin/mcp, lib/admin-api.ts):
// Model Context Protocol over Streamable HTTP, stateless (no sessions, no
// server-sent events), one JSON-RPC message per request. The tools are the
// operations of lib/openapi-admin.ts, one tool per operation, and a call runs
// the same handler as the REST request. Only for tokens with the scope mcp:
// with read the GET operations, with write the others; what a tool may reach
// is what the token owner's rights allow, as on the API. A writing tool never acts on its
// first call: it answers with what it would do and a confirmation code, and
// only the same call again with that code does it (see confirmCode). No
// database access, so `npm test` can load it.

// Newest first; an unknown version asked by a client gets the newest.
export const MCP_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];
// Seconds a confirmation code is valid.
export const CONFIRM_SECONDS = 300;

export type RpcId = string | number;
export type RpcMessage = { id?: RpcId; method: string; params?: Record<string, unknown> };

export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

// One JSON-RPC 2.0 request or notification, else an RpcError (no batches:
// the protocol dropped them in 2025-06-18).
export function rpcMessage(body: unknown): RpcMessage {
  if (Array.isArray(body)) throw new RpcError(-32600, "batches are not supported");
  if (typeof body !== "object" || body === null) throw new RpcError(-32600, "not a JSON-RPC request");
  const b = body as Record<string, unknown>;
  if (b.jsonrpc !== "2.0" || typeof b.method !== "string") throw new RpcError(-32600, "not a JSON-RPC 2.0 request");
  if (b.id !== undefined && typeof b.id !== "string" && !(typeof b.id === "number" && Number.isInteger(b.id))) throw new RpcError(-32600, "invalid id");
  if (b.params !== undefined && (typeof b.params !== "object" || b.params === null || Array.isArray(b.params))) throw new RpcError(-32602, "params must be an object");
  return { id: b.id as RpcId | undefined, method: b.method, params: b.params as Record<string, unknown> | undefined };
}

export const rpcResult = (id: RpcId | null, result: unknown) => ({ jsonrpc: "2.0", id, result });
export const rpcError = (id: RpcId | null, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

export function initializeResult(asked: unknown, version: string) {
  return {
    protocolVersion: typeof asked === "string" && MCP_VERSIONS.includes(asked) ? asked : MCP_VERSIONS[0],
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: "gameWE admin", version },
    instructions:
      "Tools of the gameWE admin API, with the rights of the token's admin. Each tool returns the JSON the REST operation of the same name returns (documented on /api). " +
      "A changing tool first only answers what it would do and a confirmation code: show that to the user, ask them, and only after their yes call the same tool again with the same arguments and `confirmation`.",
  };
}

const writes = (op: AdminOp) => op.method !== "GET";

// The operations a token may run as tools: GET with read, the others with
// write, each as far as the admin's rights reach.
export const toolOps = (user: PermUser, scopes: readonly string[]): AdminOp[] =>
  adminOps.filter((op) => allowed(user, op.need) && scopes.includes(writes(op) ? "write" : "read"));

export function tools(user: PermUser, scopes: readonly string[]) {
  return toolOps(user, scopes).map((op) => {
    const params = op.params ?? [];
    const w = writes(op);
    const required = [...params.filter((p) => p.in === "path" || p.required).map((p) => p.name), ...(op.body ? ["body"] : [])];
    return {
      name: op.operationId,
      title: op.summary,
      description: w ? `${op.description}\n\nChanges data. The first call only answers what would happen and a confirmation code; ask the user, then call again with the same arguments and confirmation.` : op.description,
      inputSchema: {
        type: "object",
        properties: {
          ...Object.fromEntries(params.map((p) => [p.name, { ...p.schema, description: p.description }])),
          ...(op.body ? { body: op.body } : {}),
          ...(w ? { confirmation: { type: "string", description: `The code of the first call, after the user agreed (valid ${CONFIRM_SECONDS / 60} minutes, for exactly these arguments)` } } : {}),
        },
        ...(required.length ? { required } : {}),
        additionalProperties: false,
      },
      annotations: w ? { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false } : { readOnlyHint: true, openWorldHint: false },
    };
  });
}

export type ToolCall = { op: AdminOp; params: Record<string, string>; query: URLSearchParams; body: unknown; args: Record<string, unknown>; confirmation?: string };

// The operation, path parameters, query and body of a tool call. The
// arguments go through the same router as a REST request (matchOp checks each
// path parameter's shape); query values become strings, so the handler checks
// them as it checks a URL; the body is checked by the handler as on the API.
export function toolCall(name: unknown, args: unknown, user: PermUser, scopes: readonly string[]): ToolCall {
  const op = toolOps(user, scopes).find((o) => o.operationId === name);
  if (!op) throw new RpcError(-32602, `unknown tool ${String(name)}`);
  if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args))) throw new RpcError(-32602, "arguments must be an object");
  const { confirmation, ...a } = (args ?? {}) as Record<string, unknown>;
  const params = op.params ?? [];
  for (const k of Object.keys(a)) if (!params.some((p) => p.name === k) && !(k === "body" && op.body)) throw new RpcError(-32602, `unknown argument ${k}`);
  if (confirmation !== undefined && (!writes(op) || typeof confirmation !== "string")) throw new RpcError(-32602, "unknown argument confirmation");
  const text = (k: string) => {
    const v = a[k];
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") throw new RpcError(-32602, `${k} must be a string or number`);
    return String(v);
  };
  const segments = op.path
    .split("/")
    .slice(2)
    .map((part) => {
      const m = /^\{(\w+)\}$/.exec(part);
      if (!m) return part;
      if (a[m[1]] === undefined) throw new RpcError(-32602, `missing argument ${m[1]}`);
      return text(m[1]);
    });
  const hit = matchOp(segments, op.method);
  if (!hit || !("op" in hit) || hit.op !== op) throw new RpcError(-32602, "invalid argument");
  const query = new URLSearchParams();
  for (const p of params) if (p.in === "query" && a[p.name] !== undefined && a[p.name] !== null) query.set(p.name, text(p.name));
  return { op, params: hit.params, query, body: a.body, args: a, confirmation: confirmation as string | undefined };
}

// JSON with sorted keys, so the same arguments in another order give the
// same confirmation code.
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}

// The confirmation code of a writing call: "<expiry>.<HMAC>" over the token,
// the tool and its exact arguments, keyed with ADMIN_SECRET, so it works on
// every instance without stored state and fits no other call or token.
// shortcut: a code can be used again until it expires (5 minutes), the same
// change once more; store used codes if that ever matters.
export function confirmCode(secret: string, tokenId: string, tool: string, args: Record<string, unknown>, now: number): string {
  const exp = now + CONFIRM_SECONDS;
  return `${exp}.${createHmac("sha256", `gamewe-mcp-confirm:${secret}`).update(`${tokenId}\n${tool}\n${exp}\n${canonical(args)}`).digest("base64url")}`;
}

export function confirmOk(code: string, secret: string, tokenId: string, tool: string, args: Record<string, unknown>, now: number): boolean {
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(code);
  if (!m || Number(m[1]) < now) return false;
  const want = Buffer.from(createHmac("sha256", `gamewe-mcp-confirm:${secret}`).update(`${tokenId}\n${tool}\n${m[1]}\n${canonical(args)}`).digest("base64url"));
  const got = Buffer.from(m[2]);
  return got.length === want.length && timingSafeEqual(got, want);
}

// A cross-site page must not reach the server through the browser of an
// admin on the same network (DNS rebinding): an Origin, if sent, must be
// this site's (Host, or X-Forwarded-Host behind a proxy).
export function originOk(origin: string | null, hosts: (string | null)[]): boolean {
  if (origin === null) return true;
  try {
    const h = new URL(origin).host;
    return hosts.some((x) => !!x && x.split(",")[0].trim() === h);
  } catch {
    return false;
  }
}
