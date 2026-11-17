import { createHash } from "node:crypto";

// Notifications by e-mail, Telegram and ntfy. The collector sends them
// (internal/notify of gameWE-collector). Every admin chooses their own
// channels, addresses and events; only the SMTP server is set up once for
// all. The web stores them in hlstats_Options, the passwords and tokens in
// hlstats_gamewe_secrets:
//   gamewe_notify_smtp_*, gamewe_notify_email_from   for all
//   gamewe_notifyu_<hash>_<channel>         an admin's own: "<events>|<address>"
//   gamewe_notifyu_<hash>_telegram_token    the admin's Telegram bot (secret)
//   gamewe_notifyu_<hash>_ntfy_token        the admin's ntfy access token (secret)
//   gamewe_notifyu_<hash>_lang              the language of the admin's messages (empty: the site's)
//   gamewe_notifyu_<hash>_last_<channel>    written by the collector: "<unix>|ok" or "<unix>|error|<text>"
// A test message is a job "notify-test" (mode: the channel; game: the
// admin's hash). No database access, so `npm test` can load it. Keep it in
// step with the collector.

export const CHANNELS = ["email", "telegram", "ntfy"] as const;
export type Channel = (typeof CHANNELS)[number];
export const isChannel = (v: unknown): v is Channel => typeof v === "string" && (CHANNELS as readonly string[]).includes(v);

// A new event: add it here and in the collector (notify.Events, its texts
// and where it is sent), with its texts in NOTIFY_T (admin-texts.ts).
export const EVENTS = ["reset", "hof", "update"] as const;
export type NotifyEvent = (typeof EVENTS)[number];
export const isEvent = (v: unknown): v is NotifyEvent => typeof v === "string" && (EVENTS as readonly string[]).includes(v);

export const NOTIFY_USER_PREFIX = "gamewe_notifyu_";
export const NOTIFY_SECRETS = ["gamewe_notify_smtp_password"];
export const DEFAULT_NTFY = "https://ntfy.sh";

export const statusKey = (c: Channel, hash: string) => `${NOTIFY_USER_PREFIX}${hash}_last_${c}`;

// The hash of an admin's keys: the one of their rights (admin-perms.ts permsKey).
export const userHash = (user: string) => createHash("sha256").update(user.trim().toLowerCase()).digest("hex").slice(0, 32);
export const ownKey = (user: string, c: Channel) => `${NOTIFY_USER_PREFIX}${userHash(user)}_${c}`;

// An admin's own Telegram bot token or ntfy access token: the collector
// sends it with that admin's messages only.
export const TOKEN_CHANNELS = ["telegram", "ntfy"] as const;
export type TokenChannel = (typeof TOKEN_CHANNELS)[number];
export const ownTokenKey = (user: string, c: TokenChannel) => `${NOTIFY_USER_PREFIX}${userHash(user)}_${c}_token`;
export const ntfyTokenOk = (v: string) => /^[A-Za-z0-9_-]{1,128}$/.test(v);
export const tokenOk = (c: TokenChannel, v: string) => (c === "telegram" ? botTokenOk(v) : ntfyTokenOk(v));

// The rows of an admin's own notifications in hlstats_Options (removed with
// the admin, as are the ownTokenKey secrets).
export const ownLangKey = (user: string) => `${NOTIFY_USER_PREFIX}${userHash(user)}_lang`;
export const ownNotifyKeys = (user: string) => [ownLangKey(user), ...CHANNELS.flatMap((c) => [ownKey(user, c), statusKey(c, userHash(user))])];

// ---------------------------------------------------------------- values

const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const CHAT = /^(-?[0-9]{1,20}|@[A-Za-z][A-Za-z0-9_]{3,31})$/;
const TOPIC = /^[A-Za-z0-9_-]{1,64}$/;
const BOT_TOKEN = /^[0-9]{1,20}:[A-Za-z0-9_-]{20,100}$/;
const HOST = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$|^\[[0-9A-Fa-f:.]{2,45}\]$/;

export const emailOk = (v: string) => v.length <= 200 && EMAIL.test(v);

// The address of a channel (ntfy: a topic; an admin's own also ownNtfyOk).
export function addressOk(c: Channel, v: string): boolean {
  if (c === "email") return emailOk(v);
  if (c === "telegram") return CHAT.test(v);
  return TOPIC.test(v);
}

// An admin's own ntfy address: a topic on ntfy.sh or the address of a
// topic on their server (https://ntfy.example.org/topic). The collector
// only sends to a public address there.
export function ownNtfyOk(v: string): boolean {
  if (TOPIC.test(v)) return true;
  if (v.length > 200) return false;
  const i = v.lastIndexOf("/");
  return i > 0 && TOPIC.test(v.slice(i + 1)) && ntfyBase(v.slice(0, i)) === v.slice(0, i);
}

export const botTokenOk = (v: string) => BOT_TOKEN.test(v);
export const hostOk = (v: string) => v.length <= 253 && HOST.test(v);

// The two fields of the ntfy address on My account: the server (empty:
// ntfy.sh) and the topic. A bad server stays in, so ownNtfyOk refuses it.
export function joinNtfy(server: string, topic: string): string {
  const t = topic.trim();
  const s = server.trim().replace(/\/+$/, "");
  if (!t || !s) return t;
  const base = ntfyBase(s);
  return base === DEFAULT_NTFY ? t : `${base ?? s}/${t}`;
}
export function splitNtfy(to: string): { server: string; topic: string } {
  const i = to.lastIndexOf("/");
  return i < 0 ? { server: "", topic: to } : { server: to.slice(0, i), topic: to.slice(i + 1) };
}

// The ntfy server: https without user, query or fragment, no trailing slash.
export function ntfyBase(v: string): string | null {
  const s = v.trim().replace(/\/+$/, "");
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password || u.search || u.hash || s.length > 255) return null;
    return s;
  } catch {
    return null;
  }
}

// A checked value of a setting of the notifications page (empty allowed),
// null if it is bad; undefined: no notify setting.
export function notifySettingValue(key: string, v: string): string | null | undefined {
  switch (key) {
    case "gamewe_notify_email_from":
      return !v || emailOk(v) ? v : null;
    case "gamewe_notify_smtp_host":
      return !v || hostOk(v) ? v : null;
    case "gamewe_notify_smtp_user":
      return /[\u0000-\u001f]/.test(v) ? null : v;
  }
  return undefined;
}

// ---------------------------------------------------------------- an admin's own

export type Own = { to: string; events: NotifyEvent[] };

// The first channel of values with a bad address or event, else null:
// saving checks all before writing any.
export function badOwn(values: Partial<Record<Channel, Own>>): Channel | null {
  for (const c of CHANNELS) {
    const v = values[c];
    const to = v?.to.trim();
    if (v && ((to && !(c === "ntfy" ? ownNtfyOk(to) : addressOk(c, to))) || !v.events.every(isEvent))) return c;
  }
  return null;
}

export const ownValue = (o: Own) => `${EVENTS.filter((e) => o.events.includes(e)).join(",")}|${o.to}`;

export function parseOwn(raw: string | null | undefined): Own {
  const i = (raw ?? "").indexOf("|");
  if (i < 0) return { to: "", events: [] };
  const events = raw!.slice(0, i).split(",").map((s) => s.trim()).filter(isEvent);
  return { to: raw!.slice(i + 1).trim(), events: EVENTS.filter((e) => events.includes(e)) };
}

// ---------------------------------------------------------------- status

export type NotifyStatus = { at: number; ok: boolean; error: string } | null;

export function parseStatus(raw: string | null | undefined): NotifyStatus {
  const m = /^(\d{1,12})\|(ok|error)(?:\|(.*))?$/s.exec((raw ?? "").trim());
  return m ? { at: Number(m[1]), ok: m[2] === "ok", error: m[3] ?? "" } : null;
}

// ---------------------------------------------------------------- webhooks
// Webhooks for the whole site (Settings → Notifications, right
// settings.protected): one row of hlstats_gamewe_webhooks per webhook, for
// one or more events (column event: "hof,reset"), which the collector calls (internal/notify webhook.go; keep the
// checks in step). gamewe_web cannot read the table: the headers hold tokens.

export const WEBHOOK_METHODS = ["POST", "PUT", "PATCH", "GET", "DELETE"] as const;
export type WebhookMethod = (typeof WEBHOOK_METHODS)[number];
export const MAX_WEBHOOK_URL = 2048;
export const MAX_WEBHOOK_TEXT = 4000; // headers, payload
export const MAX_WEBHOOK_HEADERS = 20;
export const webhookIdOk = (v: string) => /^[0-9a-f]{16}$/.test(v);

// The column event: the known events of v, in the order of EVENTS
// ("reset,hof,update" fits its 16 characters).
export const parseEvents = (v: string | null | undefined): NotifyEvent[] => {
  const got = (v ?? "").split(",").map((e) => e.trim());
  return EVENTS.filter((e) => got.includes(e));
};
export const eventsValue = (events: readonly NotifyEvent[]) => EVENTS.filter((e) => events.includes(e)).join(",");

export type WebhookHeader = { name: string; value: string };
export type Webhook = { id: string; name: string; events: NotifyEvent[]; enabled: boolean; method: WebhookMethod; url: string; headers: WebhookHeader[]; payload: string; expect: number; allowPrivate: boolean };

const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/;
// Set by the collector's HTTP client.
const RESERVED_HEADERS = ["host", "content-length", "transfer-encoding", "connection", "upgrade", "te", "trailer", "keep-alive", "proxy-connection", "expect"];
export const headerNameOk = (v: string) => HEADER_NAME.test(v) && !RESERVED_HEADERS.includes(v.toLowerCase());
// No line break or other control character (header injection); a tab is fine.
export const headerValueOk = (v: string) => !/[\u0000-\u0008\u000a-\u001f\u007f]/.test(v);

export const headersValue = (h: WebhookHeader[]) => h.map((x) => `${x.name}: ${x.value}`).join("\n");
export function parseHeaders(raw: string | null | undefined): WebhookHeader[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .filter((l) => l.includes(":"))
    .map((l) => ({ name: l.slice(0, l.indexOf(":")).trim(), value: l.slice(l.indexOf(":") + 1).trim() }));
}

// The headers to store: a sent header with an empty value keeps the stored
// value of the same name (the n-th of that name, if a name comes twice).
export function keepHeaderValues(sent: WebhookHeader[], stored: WebhookHeader[]): WebhookHeader[] {
  const seen = new Map<string, number>();
  return sent
    .filter((h) => h.name.trim())
    .map((h) => {
      const name = h.name.trim();
      const key = name.toLowerCase();
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      return { name, value: h.value.trim() || stored.filter((s) => s.name.toLowerCase() === key)[n]?.value || "" };
    });
}

export function webhookUrlOk(v: string): boolean {
  if (v.length > MAX_WEBHOOK_URL || /\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return (u.protocol === "https:" || u.protocol === "http:") && !!u.hostname && !u.username && !u.password && !u.hash && !v.includes("#");
  } catch {
    return false;
  }
}

// The first bad field of w (name, event: none or an unknown one, method, url, headers, payload,
// expect), else null.
export function badWebhook(w: Omit<Webhook, "id">): string | null {
  if (!w.name.trim() || w.name.length > 64 || /[\u0000-\u001f]/.test(w.name)) return "name";
  if (!w.events.length || !w.events.every(isEvent)) return "event";
  if (!(WEBHOOK_METHODS as readonly string[]).includes(w.method)) return "method";
  if (!webhookUrlOk(w.url)) return "url";
  if (w.headers.length > MAX_WEBHOOK_HEADERS || !w.headers.every((h) => headerNameOk(h.name) && headerValueOk(h.value)) || headersValue(w.headers).length > MAX_WEBHOOK_TEXT) return "headers";
  if (w.payload.length > MAX_WEBHOOK_TEXT) return "payload";
  if (!Number.isInteger(w.expect) || (w.expect !== 0 && (w.expect < 100 || w.expect > 599))) return "expect";
  return null;
}

// The placeholders of a payload: those of every event ({event}: reset, hof
// or update, {event_label}: its name), then the event's own (hall of fame:
// placeN_name for each stored place N), which are empty for the other
// events of a webhook.
export const WEBHOOK_VARS = ["event", "event_label", "game", "ranking", "title", "body", "url", "time", "test"] as const;
export const WEBHOOK_EVENT_VARS: Record<NotifyEvent, string[]> = {
  reset: ["by"],
  hof: ["from", "to", "places", "placeN_name", "placeN_points"], // N: 1, 2, 3 … for each stored place
  update: ["component", "version", "current", "release_url"],
};

// last_status, written by the collector: "<unix>|ok|<HTTP status>" or "<unix>|error|<text>".
export function parseWebhookStatus(raw: string | null | undefined): { at: number; ok: boolean; error: string; code: number } | null {
  const s = parseStatus(raw);
  if (!s) return null;
  return s.ok ? { ...s, code: Number(s.error) || 0, error: "" } : { ...s, code: 0 };
}
