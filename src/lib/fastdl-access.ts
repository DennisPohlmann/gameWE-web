// What the FastDL download sends besides the address: User-Agent, Referer,
// Bearer or Basic authentication and up to MAX_HEADERS headers of the admin's
// choice (one "Name: value" per line, all in one stored value). Each
// field is set for all rankings (Settings → Maps & events) and may be set again
// for one ranking (Rankings → ranking → FastDL); an empty field there takes
// the global one. password, token and header are secrets
// (hlstats_gamewe_secrets): never logged, shown only to an admin by the eye button.

export const FASTDL_ACCESS = ["agent", "referer", "user", "password", "token", "header"] as const;
export type AccessField = (typeof FASTDL_ACCESS)[number];
export type Access = Partial<Record<AccessField, string>>;

// Written out, so that the collector's check of the web's keys finds them.
export const ACCESS_KEYS: Record<AccessField, string> = {
  agent: "gamewe_fastdl_agent",
  referer: "gamewe_fastdl_referer",
  user: "gamewe_fastdl_user",
  password: "gamewe_fastdl_password",
  token: "gamewe_fastdl_token",
  header: "gamewe_fastdl_header",
};
export const ACCESS_SECRETS: readonly AccessField[] = ["password", "token", "header"];
export const accessKey = (f: AccessField, game?: string) => (game ? `${ACCESS_KEYS[f]}_${game}` : ACCESS_KEYS[f]);

const PRINTABLE = /^[^\x00-\x1f\x7f]*$/;
// Headers the request itself sets, or that would change how it is sent.
const RESERVED = new Set(["host", "content-length", "transfer-encoding", "connection", "keep-alive", "upgrade", "te", "trailer", "expect", "proxy-authorization", "user-agent", "referer", "authorization"]);
const HEADER = /^([A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}):[ \t]*(\S.*)$/;

/** The extra header "Name: value" as [name, value], or null. */
export function parseHeader(v: string): [string, string] | null {
  const m = HEADER.exec(v.trim());
  if (!m || RESERVED.has(m[1].toLowerCase()) || !PRINTABLE.test(m[2])) return null;
  return [m[1], m[2].trim()];
}

// The stored value is one varchar(255) for all of them.
export const MAX_HEADERS = 8;

/** The extra headers, one "Name: value" per line, or null when one is bad,
 *  a name comes twice or there are more than MAX_HEADERS. */
export function parseHeaders(v: string): [string, string][] | null {
  const out: [string, string][] = [];
  const names = new Set<string>();
  for (const line of v.split("\n")) {
    if (!line.trim()) continue;
    const h = parseHeader(line);
    if (!h || names.has(h[0].toLowerCase())) return null;
    names.add(h[0].toLowerCase());
    out.push(h);
  }
  return out.length <= MAX_HEADERS ? out : null;
}

/** The header rows of the form as the stored value (empty rows left out). */
export const joinHeaders = (rows: string[]) => rows.map((r) => r.trim()).filter(Boolean).join("\n");

/** Whether v may be stored in field f (empty always may). */
export function accessValueOk(f: AccessField, v: string): boolean {
  if (!v) return true;
  if (f === "header") return v.length <= 255 && parseHeaders(v) !== null;
  if (v.length > 255 || !PRINTABLE.test(v)) return false;
  if (f === "user") return !v.includes(":");
  if (f === "token") return /^[A-Za-z0-9\-._~+/]+=*$/.test(v);
  return true;
}

/** The request headers: the ranking's fields over the global ones. The
 *  authentication goes as one: the ranking's own token or user wins over
 *  anything global; a token is sent as Bearer (it wins over a user of the
 *  same level), a user with the password of the same level as Basic. */
export function fastdlHeaders(global: Access, own: Access = {}): Record<string, string> {
  const pick = (f: AccessField) => own[f] || global[f] || "";
  const out: Record<string, string> = {};
  const agent = pick("agent");
  if (agent) out["User-Agent"] = agent;
  const referer = pick("referer");
  if (referer) out["Referer"] = referer;
  const auth = own.token || own.user ? own : global;
  if (auth.token) out["Authorization"] = `Bearer ${auth.token}`;
  else if (auth.user) out["Authorization"] = `Basic ${Buffer.from(`${auth.user}:${auth.password ?? ""}`).toString("base64")}`;
  for (const [name, value] of parseHeaders(pick("header")) ?? []) out[name] = value;
  return out;
}
